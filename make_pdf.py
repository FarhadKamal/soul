from fpdf import FPDF

with open("SoulClash_Rules_Report.txt", "r", encoding="utf-8") as f:
    text = f.read()

text = (text.replace("—", "-").replace("–", "-")
            .replace("’", "'").replace("‘", "'")
            .replace("“", '"').replace("”", '"'))

pdf = FPDF(format="A4")
pdf.set_auto_page_break(auto=True, margin=15)
pdf.set_left_margin(15)
pdf.set_right_margin(15)
pdf.add_page()
pdf.set_font("Helvetica", size=10)

for raw_line in text.split("\n"):
    line = raw_line.rstrip()
    stripped = line.strip()
    is_heading = bool(stripped) and stripped == stripped.upper() and any(c.isalpha() for c in stripped) and len(stripped) < 60 and not stripped.startswith("-") and not stripped.startswith("=")

    if stripped and set(stripped) <= {"=", "-"}:
        pdf.ln(1)
        continue
    if is_heading:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 12)
        pdf.multi_cell(0, 7, stripped)
        pdf.set_font("Helvetica", size=10)
    elif not line.strip():
        pdf.ln(3)
    else:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5, line.strip())

pdf.output("SoulClash_Rules_Report.pdf")
print("done")
