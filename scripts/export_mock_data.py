import os
import re
import json
from datetime import datetime
import pandas as pd

def parse_expiry_date(date_str):
    if not date_str or pd.isna(date_str):
        return None
    date_str = str(date_str).strip()
    if date_str in ["", "-", "- -", "  -   -"]:
        return None
    for fmt in ('%d-%b-%y', '%d-%b-%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(date_str, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    return None

def main():
    excel_path = "docs/backups/stock_81.xls"
    output_path = "apps/web/lib/mock-stock-data.json"
    
    print(f"Reading Excel file: {excel_path}")
    xl = pd.ExcelFile(excel_path, engine='xlrd')
    df = xl.parse(xl.sheet_names[0], header=None)
    
    # Extract headers
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
    print(f"Loaded {len(data_df)} records.")
    
    # 1. Manufacturers
    companies = sorted(list(data_df['Company'].dropna().unique()))
    manufacturers = []
    for idx, company in enumerate(companies):
        c_name = str(company).strip()
        if not c_name:
            continue
        manufacturers.append({
            "id": f"m-{idx+1}",
            "name": c_name,
            "code": re.sub(r'[^A-Za-z0-9]', '', c_name)[:4].upper(),
            "is_active": True
        })
        
    # 2. Items and Batches
    items = []
    grouped = data_df.groupby('Code')
    
    total_stock_all = 0
    item_idx = 1
    for code, group in grouped:
        code_str = str(code).strip()
        first_row = group.iloc[0]
        name = str(first_row['Product Name']).strip()
        if not code_str or not name:
            continue
            
        batches = []
        item_stock = 0
        for b_idx, (_, row) in enumerate(group.iterrows()):
            qty = float(row['Current Stock']) if pd.notna(row['Current Stock']) else 0.0
            if qty < 0:
                qty = 0.0
            item_stock += qty
            total_stock_all += qty
            
            batches.append({
                "id": f"b-{code_str}-{b_idx+1}",
                "batch": str(row['Batch']).strip() if pd.notna(row['Batch']) else "UNSPECIFIED",
                "expiry": parse_expiry_date(row['EXP']),
                "mrp": float(row['M.R.P.']) if pd.notna(row['M.R.P.']) else 0.0,
                "stock": qty,
                "stockByLocation": {
                    "Main Warehouse": qty
                }
            })
            
        items.append({
            "id": f"i-{item_idx}",
            "code": code_str,
            "name": name,
            "packing": str(first_row['Unit']).strip() if pd.notna(first_row['Unit']) else "",
            "manufacturer": str(first_row['Company']).strip() if pd.notna(first_row['Company']) else "",
            "salt": "",
            "hsn": "",
            "gstRate": 18,
            "mrp": float(first_row['M.R.P.']) if pd.notna(first_row['M.R.P.']) else 0.0,
            "saleRate": float(first_row['Sales Price']) if pd.notna(first_row['Sales Price']) else 0.0,
            "purchaseRate": float(first_row['Purchase Price']) if pd.notna(first_row['Purchase Price']) else 0.0,
            "scheduleClass": "OTC",
            "prescriptionRequired": False,
            "coldChain": False,
            "controlledSubstance": False,
            "recalled": False,
            "stock": item_stock,
            "batches": batches,
            "batchCount": len(batches),
            "category": "Medicine",
            "status": "active"
        })
        item_idx += 1
        
    # 3. Warehouses
    warehouses = [
        {
            "id": "w1",
            "code": "MAIN",
            "name": "Main Warehouse",
            "type": "Store Room",
            "address": "Borgang",
            "capacity": 100000,
            "used": total_stock_all,
            "status": "active"
        }
    ]
    
    mock_data = {
        "manufacturers": manufacturers,
        "items": items,
        "warehouses": warehouses
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(mock_data, f, indent=2)
        
    print(f"Exported mock data to {output_path}")
    print(f"Total Manufacturers: {len(manufacturers)}")
    print(f"Total Items: {len(items)}")
    print(f"Total Stock: {total_stock_all}")

if __name__ == '__main__':
    main()
