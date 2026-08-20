import pandas as pd
from datetime import datetime, date
import json

COLUMN_ALIASES = {
    "assignee(s)": "Assignee", "assignees": "Assignee", "assignee": "Assignee",
    "task name": "Task", "task": "Task",
    "module": "Module", "description": "Description",
    "current status": "Status", "status": "Status",
    "eta": "ETA", "start date": "Start Date",
    "remarks": "Remarks",
    "email": "Email", "email address": "Email",
    "mail id": "Email", "official email": "Email",
}

def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [COLUMN_ALIASES.get(str(c).strip().lower(), str(c).strip()) for c in df.columns]
    return df

def load_tasks_test():
    xl = pd.read_excel("Fanam Project Planning & Allocation.xlsx", sheet_name=None, header=None)
    all_tasks = []
    
    # We want to identify the grouping rule.
    # A single SharePoint record might be split across multiple rows due to multiple assignees (comma separated)
    # OR it might be multiple rows with a merged Task Name.
    
    for sheet_name, raw in xl.items():
        if sheet_name in {"Projects"}: continue
        header_row = None
        for idx, row in raw.iterrows():
            vals = [str(v).strip().lower() for v in row if pd.notna(v)]
            if any(k in vals for k in ("assignee(s)", "eta", "current status", "assignees")):
                header_row = idx
                break
        if header_row is None:
            continue
            
        df = pd.read_excel("Fanam Project Planning & Allocation.xlsx", sheet_name=sheet_name, header=header_row)
        df = normalise_columns(df)
        df = df.dropna(how="all")
        
        # Forward fill structural columns that represent merged cells
        # Typically these are Phase, Task, Module, Description
        ffill_cols = [c for c in df.columns if c.lower() in ("phases", "task", "module", "description")]
        if ffill_cols:
            df[ffill_cols] = df[ffill_cols].ffill()
            
        for row_idx, row in df.iterrows():
            assignees_raw = str(row.get("Assignee", "")).strip()
            if not assignees_raw or assignees_raw.lower() in ("nan", "assignee(s)", "assignees"):
                continue
                
            # Extract ALL properties to preserve original structure
            task_data = {
                "project": sheet_name,
                "excel_row": header_row + 2 + int(row_idx)
            }
            for col in df.columns:
                val = row[col]
                if pd.isna(val):
                    val = None
                elif isinstance(val, (datetime, pd.Timestamp, date)):
                    val = val.isoformat()
                else:
                    val = str(val).strip()
                    if val.lower() == "nan": val = None
                task_data[col] = val
                
            all_tasks.append(task_data)
            
    with open("test_tasks.json", "w") as f:
        json.dump(all_tasks, f, indent=2)

load_tasks_test()
