import pdfplumber
import re
from datetime import datetime

def clean_sku_suffix(sku_str):
    if not sku_str:
        return ""
    sku_clean = sku_str.replace("\n", "").strip()
    # Strip trailing parenthesized digits (e.g. (5), (2))
    sku_clean = re.sub(r'\(\d+\)$', '', sku_clean).strip()
    match = re.search(r'([_-][a-zA-Z0-9]+)$', sku_clean)
    if match:
        suffix = match.group(1)
        remaining = sku_clean[:-len(suffix)].strip()
        # If remaining ends with 'pc' (case-insensitive) or 'pc-', don't strip
        if remaining.lower().endswith('pc') or remaining.lower().endswith('pc-'):
            return sku_clean
        return remaining
    return sku_clean

def clean_header(val):
    if val is None:
        return ""
    return str(val).strip().lower().replace("\n", " ").replace("_", " ")

def find_header_indices(row):
    sku_idx = -1
    qty_idx = -1
    date_idx = -1
    order_idx = -1
    size_idx = -1
    color_idx = -1
    
    sku_keywords = ["sku", "product code", "item sku", "seller sku", "product id"]
    qty_keywords = ["quantity", "qty", "pieces", "units", "quantity sold"]
    date_keywords = ["date", "order date", "payment date", "created date", "order time"]
    order_keywords = ["order id", "order no", "order number", "sub order id", "suborder"]
    size_keywords = ["size"]
    color_keywords = ["color", "colour"]

    for i, cell in enumerate(row):
        val = clean_header(cell)
        if not val:
            continue
        
        # Check SKU
        if sku_idx == -1 and any(kw in val for kw in sku_keywords):
            sku_idx = i
        # Check Qty
        if qty_idx == -1 and any(kw in val for kw in qty_keywords):
            qty_idx = i
        # Check Date
        if date_idx == -1 and any(kw in val for kw in date_keywords):
            date_idx = i
        # Check Order ID
        if order_idx == -1 and any(kw in val for kw in order_keywords):
            order_idx = i
        # Check Size
        if size_idx == -1 and any(kw in val for kw in size_keywords):
            size_idx = i
        # Check Color
        if color_idx == -1 and any(kw in val for kw in color_keywords):
            color_idx = i
            
    return sku_idx, qty_idx, date_idx, order_idx, size_idx, color_idx

def parse_date(date_str):
    if not date_str:
        return datetime.utcnow().isoformat() + "Z"
    
    # Try various date formats
    date_str = str(date_str).strip()
    formats = [
        "%d.%m.%Y", "%d.%m.%Y %H:%M:%S",
        "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d",
        "%d-%b-%Y", "%d %b %Y", "%b %d, %Y",
        "%d-%m-%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S", "%Y/%m/%d %H:%M:%S"
    ]
    for fmt in formats:
        try:
            parsed = datetime.strptime(date_str, fmt)
            return parsed.isoformat() + "Z"
        except ValueError:
            continue
            
    # Try to extract a date with regex if direct parsing fails
    match = re.search(r"(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})", date_str)
    if match:
        d, m, y = match.groups()
        if len(y) == 2:
            y = "20" + y
        try:
            parsed = datetime(int(y), int(m), int(d))
            return parsed.isoformat() + "Z"
        except ValueError:
            pass
            
    return datetime.utcnow().isoformat() + "Z"

def parse_qty(qty_str):
    if not qty_str:
        return 1
    # Extract digit
    digits = re.findall(r"\d+", str(qty_str))
    if digits:
        return int(digits[0])
    return 1

def extract_sales_from_pdf(file_path, original_filename=None):
    records = []
    
    # Try to extract date from the filename first
    filename_date = None
    if original_filename:
        # Match patterns like: 28.5.2026, 28-5-2026, 28_5_2026, 2026-05-28
        match = re.search(r"\b(\d{1,2})[./_](\d{1,2})[./_](\d{2,4})\b", original_filename)
        if match:
            d, m, y = match.groups()
            if len(y) == 2:
                y = "20" + y
            try:
                parsed = datetime(int(y), int(m), int(d))
                filename_date = parsed.isoformat() + "Z"
            except ValueError:
                pass
            
    with pdfplumber.open(file_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            # Extract text first so we can use it to guard against false-positive skips
            text = page.extract_text()

            # Skip pages that are FAST Dispatch shipping-label-only pages.
            # To avoid skipping real product pages, only skip if the page has NO product-related text.
            PRODUCT_KEYWORDS = ["Product Details", "SKU", "MEN-WB", "MEN-GB", "KIDS-WB", "KIDS-GB",
                                 "LDS-WB", "LDS-GB", "BARFI", "SHPC", "TRACK-PC", "PC-2", "PC-3",
                                 "Seller SKU", "Item SKU", "Order ID", "Pyjama", "STRIP-SH", "CORD-SH"]
            page_has_product_content = text and any(kw.lower() in text.lower() for kw in PRODUCT_KEYWORDS)

            if not page_has_product_content:
                # Check for the FAST Dispatch label image signature
                is_fast_dispatch = False
                for img in page.images:
                    w = img.get('width', 0)
                    h = img.get('height', 0)
                    y0 = img.get('y0', 0)
                    if 550 <= w <= 580 and 30 <= h <= 40 and y0 > 750:
                        is_fast_dispatch = True
                        break
                if is_fast_dispatch:
                    continue

            if not text:
                continue

            lines = text.split("\n")

            # 1. Extract Invoice Date dynamically from the text lines

            date_val = filename_date
            
            if not date_val:
                # Look for lines with date keywords first (higher priority)
                for line in lines:
                    lower_line = line.lower()
                    if "date" in lower_line or "dt" in lower_line or "ordered" in lower_line:
                        date_matches = re.findall(r"\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b", line)
                        if date_matches:
                            date_val = parse_date(date_matches[-1])
                            break
            
            if not date_val:
                # Fallback if no date keyword line was found
                for line in lines:
                    date_matches = re.findall(r"\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b", line)
                    if date_matches:
                        date_val = parse_date(date_matches[-1])
                        break
            
            if not date_val:
                date_val = datetime.utcnow().isoformat() + "Z"
                
            page_records = []
            
            # Extract pack size from description in the text
            pack_size = None
            for line in lines:
                pack_match = re.search(r"pack\s*of\s*(\d+)", line, re.IGNORECASE)
                if pack_match:
                    pack_size = int(pack_match.group(1))
                    break
            
            # 2. Extract Product Details via robust line parsing
            product_details_found = False
            for idx, line in enumerate(lines):
                if "Product Details" in line:
                    if idx + 2 < len(lines) and "SKU" in lines[idx + 1] and "Qty" in lines[idx + 1]:
                        data_line = lines[idx + 2]
                        parts = data_line.split()
                        if len(parts) >= 4:
                            product_details_found = True
                            order_id = parts[-1]
                            color_val = parts[-2]
                            qty_val = parse_qty(parts[-3])
                            
                            if len(parts) >= 5:
                                # Check if size has multiple words (e.g. "14-15 Years", "15-16 Yrs")
                                if len(parts) >= 6 and parts[-4].lower() in ["years", "yr", "yrs", "year"]:
                                    size_val = f"{parts[-5]} {parts[-4]}"
                                    raw_sku_str = " ".join(parts[:-5])
                                else:
                                    size_val = parts[-4]
                                    raw_sku_str = " ".join(parts[:-4])
                            else:
                                size_val = ""
                                raw_sku_str = parts[0]
                                
                            # Check for wrapped SKU parts on subsequent lines before TAX INVOICE/Original For Recipient etc.
                            current_idx = idx + 3
                            while current_idx < len(lines):
                                next_line = lines[current_idx].strip()
                                if not next_line or any(h in next_line for h in ["TAX INVOICE", "Original For Recipient", "BILL TO", "Purchase Order", "Description", "Other Charges"]):
                                    break
                                raw_sku_str += " " + next_line
                                current_idx += 1
                            
                            # Clean SKU printer/order suffixes dynamically and merge wrap lines
                            cleaned_sku = clean_sku_suffix(raw_sku_str).replace("\n", "").replace(" ", "")
                            
                            rec = {
                                "raw_sku": cleaned_sku,
                                "size": size_val,
                                "color": color_val,
                                "quantity": qty_val,
                                "date": date_val,
                                "order_id": order_id
                            }
                            if pack_size is not None:
                                rec["pack_size"] = pack_size
                            records.append(rec)
                            page_records.append(rec)
                            break
            
            # Fallback to Table extraction if Product Details text block was not found on this page
            if not product_details_found:
                tables = page.extract_tables()
                for table in tables:
                    if len(table) < 2:
                        continue
                    
                    header_row_idx = -1
                    sku_idx, qty_idx, date_idx, order_idx, size_idx, color_idx = -1, -1, -1, -1, -1, -1
                    
                    for idx in range(min(5, len(table))):
                        s, q, d, o, sz, col = find_header_indices(table[idx])
                        if s != -1:
                            sku_idx, qty_idx, date_idx, order_idx, size_idx, color_idx = s, q, d, o, sz, col
                            header_row_idx = idx
                            break
                    
                    if header_row_idx != -1:
                        for row in table[header_row_idx + 1:]:
                            if len(row) <= sku_idx:
                                continue
                            
                            raw_sku = row[sku_idx]
                            if not raw_sku:
                                continue
                            
                            raw_sku_str = str(raw_sku).strip().replace("\n", " ")
                            raw_sku_lower = raw_sku_str.lower()
                            
                            junk_keywords = ["tax invoice", "bill to", "ship to", "description of", "hsn", "total", "sgst", "cgst", "igst", "authorized", "signature", "recipient", "declaration", "page", "original for"]
                            if any(jk in raw_sku_lower for jk in junk_keywords):
                                continue
                                
                            if not raw_sku_str:
                                continue
                            
                            cleaned_sku = clean_sku_suffix(raw_sku_str).replace(" ", "")
                            qty = parse_qty(row[qty_idx]) if qty_idx != -1 else 1
                            order_id = str(row[order_idx]).strip() if order_idx != -1 and row[order_idx] else f"MOCK-{datetime.utcnow().timestamp()}"
                            size_val = str(row[size_idx]).strip() if size_idx != -1 and row[size_idx] else ""
                            color_val = str(row[color_idx]).strip() if color_idx != -1 and row[color_idx] else ""
                            
                            rec = {
                                "raw_sku": cleaned_sku,
                                "size": size_val,
                                "color": color_val,
                                "quantity": qty,
                                "date": date_val,
                                "order_id": order_id
                            }
                            if pack_size is not None:
                                rec["pack_size"] = pack_size
                            records.append(rec)
                            page_records.append(rec)

            # 3. Intelligent Page Text Fallback Scanner
            if not page_records:
                known_patterns = [
                    r"\bMEN-GB-BGY-PC-\d+\b",
                    r"\bMEN-WB-BGY-PC-\d+\b",
                    r"\bKIDS-GB-BGY-PC-\d+\b",
                    r"\bKIDS-WB-BGY-PC-\d+\b",
                    r"\bLDS-GB-BGY-PC-\d+\b",
                    r"\bLDS-WB-BGY-PC-\d+\b",
                    r"\bMEN-KB-BGY-PC-\d+\b",
                    r"\bSTRIP-SH-WB-PC-\d+\b",
                    r"\bCORD-SH-PC-\d+\b",
                    r"\bKIDS-TRACK-PC-\d+\b",
                    r"\bKIDS-BARFI-PC-\d+\b",
                    r"\bBARFI-PC-\d+\b",
                    r"\bKIDS-Pyjm-PC-\d+\b",
                    r"\bPyjama-PC-\d+\b",
                    r"\bZIPER-TRACK-PC-\d+\b",
                    r"\bSHIRTPC-\d+\b",
                    r"\bTRACK-PC-\d+\b",
                    r"\bSHPC-\d+\b",
                    r"\bPC-\d+-\([A-Z+]+\)-[A-Z+]+\b",
                    r"\bPC[-_]?\d+\s+KIDS\s+BARFI\b",
                    r"\bPC[-_]?\d+\s+\([A-Z+]+\)\b",
                    r"\bPC[-_]?\d+\b",
                ]
                
                found_sku = None
                full_text_clean = text.replace("\n", " ").replace("  ", " ")
                for pattern in known_patterns:
                    match = re.search(pattern, full_text_clean, re.IGNORECASE)
                    if match:
                        found_sku = match.group(0)
                        break
                
                if not found_sku:
                    prefixes = ["SHPC", "TRACK-PC", "SHIRTPC", "ZIPER-TRACK-PC", "Pyjama-PC", "KIDS-Pyjm-PC", "KIDS-TRACK-PC", "KIDS-BARFI-PC", "BARFI-PC", "PANTPC", "LDS-GB", "LDS-WB", "KIDS-WB", "KIDS-GB", "MEN-WB", "MEN-GB", "CORD-SH", "STRIP-SH", "MEN-KB"]
                    for pref in prefixes:
                        match = re.search(r"\b" + re.escape(pref) + r"\S*", full_text_clean, re.IGNORECASE)
                        if match:
                            found_sku = match.group(0)
                            break
                            
                if found_sku:
                    found_sku = found_sku.strip()
                    found_sku = clean_sku_suffix(found_sku).replace(" ", "")
                    
                    size_val = ""
                    size_match = re.search(r"\b(S|M|L|XL|XXL|3XL|FS|24|26|28|30|32|34|36)\b", full_text_clean)
                    if size_match:
                        size_val = size_match.group(1)
                        
                    color_val = "Assorted"
                    color_match = re.search(r"\b(Red|Black|Navy|Blue|Grey|Green|White|Yellow|Pink|Orange|Assorted|BLK|GRY|WHT|RED)\b", full_text_clean, re.IGNORECASE)
                    if color_match:
                        color_val = color_match.group(1)
                        
                    order_match = re.search(r"\b\d{15,20}\b", full_text_clean)
                    order_id = order_match.group(0) if order_match else f"MOCK-{datetime.utcnow().timestamp()}"
                    
                    rec = {
                        "raw_sku": found_sku,
                        "size": size_val,
                        "color": color_val,
                        "quantity": 1,
                        "date": date_val,
                        "order_id": order_id
                    }
                    if pack_size is not None:
                        rec["pack_size"] = pack_size
                    records.append(rec)
                    page_records.append(rec)
                            
    return records
