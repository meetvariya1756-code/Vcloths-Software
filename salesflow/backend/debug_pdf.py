import pdfplumber
import os
import re
import sys
sys.path.append(r"d:\Vcloths-Software\salesflow\pdf-parser")
from parser import extract_sales_from_pdf

pdf_path = r"C:\Users\Venner\Downloads\8.6 (1)  DONE.pdf"
records = extract_sales_from_pdf(pdf_path, "8.6 (1)  DONE.pdf")

print(f"Extracted {len(records)} records:")
for idx, r in enumerate(records):
    print(f"{idx+1}: Page SKU={r['raw_sku']} | Qty={r['quantity']} | Order={r['order_id']}")

