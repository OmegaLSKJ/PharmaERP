import os
import re
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime
import pandas as pd

def load_env(env_path):
    env_vars = {}
    if not os.path.exists(env_path):
        return env_vars
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            match = re.match(r'^([^=]+)=(.*)$', line)
            if match:
                key = match.group(1).strip()
                val = match.group(2).strip()
                if val.startswith('"') and val.endswith('"'):
                    val = val[1:-1]
                elif val.startswith("'") and val.endswith("'"):
                    val = val[1:-1]
                env_vars[key] = val
    return env_vars

def parse_expiry_date(date_str):
    if not date_str or pd.isna(date_str):
        return None
    date_str = str(date_str).strip()
    if date_str in ["", "-", "- -", "  -   -"]:
        return None
    
    # Try parsing format DD-MMM-YY (e.g. 01-Sep-26) or DD-MMM-YYYY
    for fmt in ('%d-%b-%y', '%d-%b-%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(date_str, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    return None

def supabase_post(url, key, endpoint, payload):
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    req_data = json.dumps(payload).encode('utf-8')
    full_url = f"{url}/rest/v1/{endpoint}"
    req = urllib.request.Request(full_url, data=req_data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode('utf-8')
            if body:
                return json.loads(body), resp.status
            return None, resp.status
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code} for endpoint {endpoint}: {e.read().decode('utf-8')}")
        raise e
    except Exception as e:
        print(f"Failed to call endpoint {endpoint}: {e}")
        raise e

def main():
    excel_path = r"docs/backups/stock_81.xls"
    env_path = r".env.production.local"
    
    print("=== Supabase Stock Data Ingestion ===")
    print(f"Reading Excel file: {excel_path}")
    if not os.path.exists(excel_path):
        print(f"Error: Excel backup file not found at {excel_path}. Make sure to copy it first.")
        sys.exit(1)
        
    try:
        # Load Excel using xlrd
        xl = pd.ExcelFile(excel_path, engine='xlrd')
        sheet_name = xl.sheet_names[0]
        df = xl.parse(sheet_name, header=None)
        
        # Structure of the Excel sheet:
        # Row 0: Company name header
        # Row 1: Stock report date header
        # Row 2: Columns list
        # Row 3: Sub-headers (Deal, Free etc.)
        # Row 4 onwards: Product records
        
        row2 = df.iloc[2].tolist()
        row3 = df.iloc[3].tolist()
        
        headers = []
        current_primary = ""
        for idx, (primary, sub) in enumerate(zip(row2, row3)):
            p_val = str(primary).strip() if pd.notna(primary) else ""
            s_val = str(sub).strip() if pd.notna(sub) else ""
            if p_val:
                current_primary = p_val
            if s_val:
                header_name = f"{current_primary} - {s_val}"
            else:
                header_name = current_primary if current_primary else f"Col_{idx}"
            headers.append(header_name)
            
        df.columns = headers
        data_df = df.iloc[4:].reset_index(drop=True)
        print(f"Successfully loaded {len(data_df)} records from Excel sheet '{sheet_name}'.")
    except Exception as e:
        print(f"Error reading Excel sheet: {e}")
        sys.exit(1)
        
    # Group and prepare data
    print("Preparing master datasets...")
    
    # 1. Manufacturers
    companies = data_df['Company'].dropna().unique()
    manufacturers_payload = [{"name": str(c).strip()} for c in companies if str(c).strip()]
    print(f"- Unique Manufacturers found: {len(manufacturers_payload)}")
    
    # 2. Items (Products)
    # Deduplicate items by product code
    unique_items = data_df.drop_duplicates(subset=['Code']).copy()
    items_payload = []
    for _, row in unique_items.iterrows():
        code = str(row['Code']).strip()
        name = str(row['Product Name']).strip()
        if not code or not name:
            continue
        items_payload.append({
            "code": code,
            "name": name,
            "packing": str(row['Unit']).strip() if pd.notna(row['Unit']) else None,
            "manufacturer": str(row['Company']).strip() if pd.notna(row['Company']) else None,
            "mrp": float(row['M.R.P.']) if pd.notna(row['M.R.P.']) else 0.0,
            "sale_rate": float(row['Sales Price']) if pd.notna(row['Sales Price']) else 0.0,
            "purchase_rate": float(row['Purchase Price']) if pd.notna(row['Purchase Price']) else 0.0,
            "status": "active"
        })
    print(f"- Unique Items found: {len(items_payload)}")
    
    # 3. Opening Stock records
    stock_payload = []
    for _, row in data_df.iterrows():
        code = str(row['Code']).strip()
        if not code or pd.isna(row['Current Stock']):
            continue
        qty = float(row['Current Stock'])
        if qty < 0:
            continue
            
        expiry = parse_expiry_date(row['EXP'])
        stock_payload.append({
            "item_code": code,
            "warehouse_code": "MAIN",
            "quantity": qty,
            "batch": str(row['Batch']).strip() if pd.notna(row['Batch']) else "UNSPECIFIED",
            "expiry": expiry,
            "mrp": float(row['M.R.P.']) if pd.notna(row['M.R.P.']) else 0.0,
            "remarks": "Opening stock import from stock_81.xls"
        })
    print(f"- Stock Movement records prepared: {len(stock_payload)}")
    
    # Check credentials
    env = load_env(env_path)
    url = env.get('SUPABASE_URL')
    key = env.get('SUPABASE_SECRET_KEY')
    
    is_dry_run = True
    if url and key and url != "[SENSITIVE]" and key != "[SENSITIVE]":
        is_dry_run = False
        
    if is_dry_run:
        print("\n>>> Running in DRY-RUN MODE (Supabase environment variables are not configured or are SENSITIVE) <<<")
        print("Here is a sample of the prepared payload:")
        print("\nManufacturers sample (first 3):")
        print(json.dumps(manufacturers_payload[:3], indent=2))
        print("\nItems sample (first 3):")
        print(json.dumps(items_payload[:3], indent=2))
        print("\nOpening Stock sample (first 3):")
        print(json.dumps(stock_payload[:3], indent=2))
        
        # Write to a JSON file in backups as validation
        sample_path = "docs/backups/sample_import_validation.json"
        with open(sample_path, 'w', encoding='utf-8') as f:
            json.dump({
                "manufacturers": manufacturers_payload[:10],
                "items": items_payload[:10],
                "opening_stock": stock_payload[:10]
            }, f, indent=2)
        print(f"\nWritten validation sample to: {sample_path}")
        print("Dry-run completed successfully.")
    else:
        print("\n>>> Pushing data to Supabase Production database... <<<")
        try:
            # 1. Fetch organization ID or create it
            print("Resolving Organization 'Borgang Drug Distributors'...")
            # Query organization
            # Postgrest RPC syntax requires calling endpoints
            # We can select from public.organizations
            headers = {
                'apikey': key,
                'Authorization': f'Bearer {key}',
            }
            req = urllib.request.Request(f"{url}/rest/v1/organizations?name=eq.Borgang%20Drug%20Distributors", headers=headers)
            with urllib.request.urlopen(req) as resp:
                orgs = json.loads(resp.read().decode('utf-8'))
            
            if orgs:
                org_id = orgs[0]['id']
                print(f"Found organization ID: {org_id}")
            else:
                print("Creating organization 'Borgang Drug Distributors'...")
                res, _ = supabase_post(url, key, 'organizations', {"name": "Borgang Drug Distributors"})
                org_id = res[0]['id']
                print(f"Created organization ID: {org_id}")
                
            # 2. Make sure warehouse 'MAIN' exists
            print("Ensuring warehouse 'MAIN' exists...")
            req = urllib.request.Request(f"{url}/rest/v1/warehouses?code=eq.MAIN&organization_id=eq.{org_id}", headers=headers)
            with urllib.request.urlopen(req) as resp:
                whs = json.loads(resp.read().decode('utf-8'))
            if not whs:
                print("Creating default warehouse 'MAIN'...")
                supabase_post(url, key, 'warehouses', {
                    "organization_id": org_id,
                    "code": "MAIN",
                    "name": "Main Warehouse",
                    "warehouse_type": "Store Room",
                    "capacity": 10000.0,
                    "is_active": True
                })
                print("Warehouse 'MAIN' created.")
            
            # 3. Call erp_import_master for Manufacturers
            print(f"Importing {len(manufacturers_payload)} manufacturers...")
            res, _ = supabase_post(url, key, 'rpc/erp_import_master', {
                "p_type": "manufacturers",
                "p_organization_id": org_id,
                "p_rows": manufacturers_payload
            })
            print(f"Manufacturers imported: {res}")
            
            # 4. Call erp_import_master for Items
            print(f"Importing {len(items_payload)} items...")
            # Split items into chunks of 1000 rows to stay within limits/safeguards
            chunk_size = 1000
            for i in range(0, len(items_payload), chunk_size):
                chunk = items_payload[i:i+chunk_size]
                print(f"- Ingesting items chunk {i//chunk_size + 1} ({len(chunk)} items)...")
                res, _ = supabase_post(url, key, 'rpc/erp_import_master', {
                    "p_type": "items",
                    "p_organization_id": org_id,
                    "p_rows": chunk
                })
            print("Items imported successfully.")
            
            # 5. Call erp_import_master for Opening Stock
            print(f"Importing {len(stock_payload)} opening stock entries...")
            for i in range(0, len(stock_payload), chunk_size):
                chunk = stock_payload[i:i+chunk_size]
                print(f"- Ingesting stock chunk {i//chunk_size + 1} ({len(chunk)} entries)...")
                res, _ = supabase_post(url, key, 'rpc/erp_import_master', {
                    "p_type": "opening-stock",
                    "p_organization_id": org_id,
                    "p_rows": chunk
                })
            print("Stock movements imported successfully.")
            print("Ingestion process completed successfully!")
            
        except Exception as e:
            print(f"Error during Supabase ingestion: {e}")
            sys.exit(1)

if __name__ == '__main__':
    main()
