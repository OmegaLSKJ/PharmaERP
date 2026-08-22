# Role/action matrix

| Capability | Admin | Manager | Operator |
|---|---:|---:|---:|
| Read masters | Yes | Yes | Yes |
| Create/update masters | Yes | Yes | No |
| Delete masters | Yes | No | No |
| Read sales/purchases/challans | Yes | Yes | Yes |
| Post operational transactions | Yes | Yes | Yes |
| Cancel posted transactions | Yes | Yes | No |
| Read inventory | Yes | Yes | Yes |
| Reserve/transfer/adjust inventory | Yes | Yes | No |
| Read accounts/reports | Yes | Yes | Yes |
| Post vouchers/reconcile | Yes | Yes | No |
| Close accounting periods | Yes | No | No |
| Execute CSV/Excel imports | Yes | Yes | No |
| Read compliance registers | Yes | Yes | Yes |
| Manage licences and recalls | Yes | Yes | No |
| Manage users, roles and environment | Yes | No | No |

Unknown or missing role claims are treated as Operator. Server-side authorization is enforced on every ERP API method; UI visibility is not a security boundary.
