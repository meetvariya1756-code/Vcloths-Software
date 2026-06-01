import pdfplumber
import os
import re

downloads_path = r"C:\Users\Venner\Downloads"
target_file = None
for f in os.listdir(downloads_path):
    if "27.6.2026" in f and "DONE" in f:
        target_file = os.path.join(downloads_path, f)
        break

if not target_file:
    print("Could not find PDF file!")
    exit(1)

records = []
with pdfplumber.open(target_file) as pdf:
    for page_num, page in enumerate(pdf.pages):
        text = page.extract_text()
        if not text:
            continue
            
        lines = text.split("\n")
        
        # 1. Extract Date from invoice section
        date_val = None
        for line in lines:
            # Look for two dates, e.g. "26.05.2026 27.05.2026"
            date_matches = re.findall(r"\b\d{2}\.\d{2}\.\d{4}\b", line)
            if date_matches:
                # Use the last one (Invoice Date) or the first one (Order Date)
                date_val = date_matches[-1] # e.g. "27.05.2026"
                break
                
        # 2. Extract Product Details
        for idx, line in enumerate(lines):
            if "Product Details" in line:
                if idx + 2 < len(lines) and "SKU" in lines[idx + 1] and "Qty" in lines[idx + 1]:
                    data_line = lines[idx + 2]
                    parts = data_line.split()
                    if len(parts) >= 5:
                        order_id = parts[-1]
                        color = parts[-2]
                        qty = parts[-3]
                        size = parts[-4]
                        sku = " ".join(parts[:-4])
                        
                        records.append({
                            "sku": sku,
                            "size": size,
                            "qty": qty,
                            "color": color,
                            "order_id": order_id,
                            "date": date_val
                        })
                        break

print(f"Parsed records count: {len(records)}")
print("\nFirst 10 records:")
for r in records[:10]:
    print(r)
