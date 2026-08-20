import pandas as pd
import json

excel_path = "Fanam Project Planning & Allocation.xlsx"
try:
    xl = pd.read_excel(excel_path, sheet_name=None, header=None)
    output = {}
    for sheet_name, df in xl.items():
        if len(df) > 0:
            output[sheet_name] = df.head(10).to_dict(orient="records")
    
    with open("excel_structure.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    print("Done")
except Exception as e:
    print(f"Error: {e}")
