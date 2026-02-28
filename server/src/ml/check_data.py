import pandas as pd

df = pd.read_csv("data/parkinsons.csv")

print("Shape:", df.shape)
print("\nColumns:")
print(df.columns)

print("\nFirst 2 rows:")
print(df.head(2))