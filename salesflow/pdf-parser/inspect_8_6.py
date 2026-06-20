import pdfplumber
import os

pdf_path = r"C:\Users\Venner\Downloads\8.6 (1)  DONE.pdf"

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total Pages: {len(pdf.pages)}")
    for idx, page in enumerate(pdf.pages):
        text = page.extract_text()
        print(f"\n--- Page {idx + 1} ---")
        lines = text.split("\n") if text else []
        for line in lines:
            if "Product Details" in line or "SKU" in line or "BARFI" in line or "Burfi" in line:
                print(f"  {line}")
            # print all lines if needed, let's print lines that look like product data
            if any(k in line for k in ["PC-", "PC_", "SHPC", "BARFI", "BURFI"]):
                print(f"  DATA LINE: {line}")
