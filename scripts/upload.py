import pandas as pd
df = pd.read_csv('/Users/maheshchintala/Downloads/TGSRTC/data/routes.txt')
print("--- ACTUAL COLUMNS IN YOUR FILE ---")
print(df.columns.tolist())
print("\n--- FIRST ROW OF DATA ---")
print(df.iloc[0].to_dict())