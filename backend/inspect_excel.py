import pandas as pd
import sys

try:
    df = pd.read_excel(r"e:\Projects\WorkMate\workmate\backend\teams_reminder\Employee Master Sheet .xlsx")
    print("Columns:", df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.head().to_dict(orient="records"))
except Exception as e:
    print(f"Error: {e}")
