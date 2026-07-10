#!/usr/bin/env python3
"""Generate ERA hosting requirements PDF for Hostart (Baku)."""

from datetime import date
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import XPos, YPos

OUT = Path(__file__).resolve().parent / "ERA_Hosting_Requirements_Hostart.pdf"


class PDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 6, "ERA Ecosystem - Hosting Requirements (Hostart)", align="L")
        self.ln(8)

    def footer(self):
        self.set_y(-14)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(
            0,
            8,
            f"Page {self.page_no()}/{{nb}}  |  Confidential - for quotation purposes",
            align="C",
        )

    def p(self, text: str, h: float = 5.5):
        """Paragraph that always returns to left margin."""
        self.multi_cell(0, h, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def h2(self, text: str):
        self.ln(3)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(30, 60, 100)
        self.p(text, 7)
        self.ln(1)

    def h3(self, text: str):
        self.ln(1)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(40, 40, 40)
        self.p(text, 6)
        self.ln(0.5)

    def body(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.p(text, 5.5)
        self.ln(1)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.set_x(self.l_margin + 4)
        usable = self.w - self.r_margin - self.get_x()
        self.multi_cell(usable, 5.5, f"- {text}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def table(self, headers: list[str], rows: list[list[str]], col_widths: list[float]):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(30, 60, 100)
        self.set_text_color(255, 255, 255)
        for h, w in zip(headers, col_widths):
            self.cell(w, 7, h, border=1, fill=True, align="C")
        self.ln()
        self.set_font("Helvetica", "", 9)
        self.set_text_color(30, 30, 30)
        fill = False
        for row in rows:
            self.set_x(self.l_margin)
            if fill:
                self.set_fill_color(240, 244, 248)
            else:
                self.set_fill_color(255, 255, 255)
            for cell, w in zip(row, col_widths):
                self.cell(w, 6.5, cell, border=1, fill=True, align="L")
            self.ln()
            fill = not fill
        self.ln(2)


def build() -> None:
    pdf = PDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(14, 14, 14)
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(20, 40, 70)
    pdf.p("ERA Ecosystem", 10)
    pdf.set_font("Helvetica", "B", 14)
    pdf.p("Virtual Server Hosting Requirements", 8)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(80, 80, 80)
    pdf.p("Prepared for: Hostart LLC (Baku, Azerbaijan)", 6)
    pdf.p(f"Document date: {date.today().isoformat()}", 6)
    pdf.p("Language: English  |  Purpose: technical quotation / RFP", 6)
    pdf.ln(2)
    y = pdf.get_y()
    pdf.set_draw_color(30, 60, 100)
    pdf.set_line_width(0.4)
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.ln(4)

    pdf.h2("1. Purpose")
    pdf.body(
        "This document describes the technical requirements for hosting the ERA Ecosystem "
        "production platform on infrastructure provided by Hostart. We request a quotation "
        "for the configurations below. Pricing should not be constrained by a budget ceiling "
        "in this RFP - please quote the recommended and optional items separately."
    )

    pdf.h2("2. Workload summary")
    pdf.body(
        "ERA is a multi-application business platform (control plane + finance ERP + industry "
        "satellites) deployed as a Docker Compose stack on Linux."
    )
    pdf.bullet(
        "Target scale (Phase 1): up to 10,000 registered user accounts (not concurrent sessions)."
    )
    pdf.bullet(
        "Expected concurrent sessions at launch: roughly 50-200; growth toward ~300-500."
    )
    pdf.bullet(
        "Approximate stack size: ~20 containers (PostgreSQL 16 with multiple databases, Redis 7, "
        "Traefik reverse proxy, NestJS APIs, multiple Next.js applications)."
    )
    pdf.bullet(
        "Public entry: HTTPS via Traefik on ports 80/443; many subdomains on one public IPv4."
    )
    pdf.bullet(
        "Domain/DNS: remains under our control (era-365.online). Hostart provides server + public IP only."
    )

    pdf.h2("3. Phase 1 - Primary production VM (all-in-one)")
    pdf.body(
        "Initial deployment runs the full stack on a single virtual machine. "
        "Please quote the Target configuration as primary; Pilot may be offered as a lower-cost start option."
    )
    pdf.table(
        ["Parameter", "Pilot (optional)", "Target (preferred)"],
        [
            ["vCPU", "8 dedicated", "16 dedicated"],
            ["RAM", "32 GB", "64 GB"],
            ["Storage", "200-320 GB NVMe SSD", "400-500 GB NVMe SSD"],
            ["Network", "1 Gbps uplink", "1 Gbps uplink"],
            ["Transfer", "Unmetered or >= 5 TB/mo", "Unmetered or >= 7 TB/mo"],
            ["Virtualization", "KVM (not OpenVZ)", "KVM (not OpenVZ)"],
            ["Public IPv4", "1 address", "1 address"],
            ["IPv6", "Optional", "Optional"],
        ],
        [50, 65, 65],
    )
    pdf.body(
        "CPU must be dedicated (or clearly guaranteed). Shared/burstable-only plans are not suitable "
        "for this workload. NVMe SSD is required; HDD is not acceptable for the primary disk."
    )

    pdf.h2("4. Phase 2 - Database separation (required growth path)")
    pdf.body(
        "A single VM is acceptable for launch, but we consider separating PostgreSQL (and preferably Redis) "
        "onto dedicated infrastructure as a necessary next step for stability under growth. "
        "Please quote Phase 2 as an optional add-on / upgrade path (not mandatory on day one)."
    )
    pdf.h3("4.1 Preferred Phase 2 layout")
    pdf.bullet(
        "VM A - Application tier: Docker Compose apps + Traefik (e.g. 8-16 vCPU / 32-64 GB RAM / 200+ GB NVMe)."
    )
    pdf.bullet(
        "VM B - Data tier: PostgreSQL 16 (+ optional Redis), private network only for DB ports "
        "(e.g. 4-8 vCPU / 32-64 GB RAM / 400+ GB NVMe, backups attached)."
    )
    pdf.bullet("Private networking between VMs (VLAN / VPC / private IP) is required for Phase 2.")
    pdf.bullet(
        "Please confirm whether vertical resize (CPU/RAM) and adding a second VM are supported without full rebuild."
    )

    pdf.h2("5. Optional - Staging environment")
    pdf.body(
        "Please quote an optional smaller second VM for staging/UAT (same OS and Docker capability). "
        "Suggested starting size: 4-8 vCPU / 16-32 GB RAM / 150-200 GB NVMe. "
        "Staging may share the same firewall patterns; it must have a separate public IP or clear routing plan."
    )

    pdf.h2("6. Operating system and software requirements")
    pdf.bullet("OS: Ubuntu 24.04 LTS (x86_64) preferred; Ubuntu 22.04 LTS acceptable.")
    pdf.bullet(
        "Access: root or sudo-capable SSH user; SSH key authentication; password login disabled preferred."
    )
    pdf.bullet(
        "We prefer unmanaged / self-managed administration. Optional managed OS patching may be quoted separately."
    )
    pdf.bullet(
        "Docker Engine 24+ and Docker Compose v2 must be allowed (we can install; please confirm no policy blocks containers)."
    )
    pdf.bullet("cPanel / shared hosting control panels are not required and must not restrict Docker.")
    pdf.bullet("Outbound HTTPS (443) and package repositories must be reachable for updates and image pulls.")
    pdf.bullet("Ability to run 20+ concurrent containers without artificial process/container caps.")
    pdf.bullet("Reasonable ulimits / file descriptor limits suitable for Node.js and PostgreSQL.")

    pdf.h2("7. Network, firewall, and DNS")
    pdf.h3("7.1 Ports")
    pdf.bullet("MUST be reachable from Internet: TCP 22 (SSH), 80 (HTTP), 443 (HTTPS).")
    pdf.bullet("MUST NOT be exposed to Internet: PostgreSQL 5432, Redis 6379 (and similar data ports).")
    pdf.bullet("Cloud or host firewall configuration support is required (UFW and/or provider firewall).")
    pdf.h3("7.2 DNS (our side)")
    pdf.bullet("We manage DNS for era-365.online (and related zones).")
    pdf.bullet(
        "We will create multiple A records pointing to the provided public IP (app, api, finance-core, hotel-pms, etc.)."
    )
    pdf.bullet("Please provide the public IPv4 promptly after provisioning; reverse DNS (PTR) is a plus if available.")

    pdf.h2("8. Security, backups, and operations")
    pdf.bullet(
        "Data center location (MANDATORY): all compute and primary data storage must be physically "
        "located in Azerbaijan (Baku preferred). Please confirm the facility name in writing."
    )
    pdf.bullet("DDoS protection: please describe what is included at network/DC level.")
    pdf.bullet("Snapshots: VM snapshot capability and frequency options.")
    pdf.bullet(
        "Backups: please describe available backup products (disk image and/or filesystem). "
        "We will also run application-level PostgreSQL dumps; off-server backup storage options are of interest "
        "(backup copies must also remain in Azerbaijan unless otherwise agreed in writing)."
    )
    pdf.bullet("SLA: please state monthly uptime SLA and maintenance window policy.")
    pdf.bullet("Support: channels, languages (AZ/RU/EN), business-hours vs 24/7, response time targets.")
    pdf.bullet(
        "NDA (MANDATORY): a mutual Non-Disclosure Agreement must be executed before we share "
        "detailed architecture, credentials, or production access. Please send your standard NDA "
        "or confirm you will sign ours."
    )

    pdf.h2("9. Data residency and confidentiality (mandatory)")
    pdf.body(
        "The following are hard requirements for this engagement:"
    )
    pdf.bullet(
        "Data residency: production workloads and primary databases must reside on infrastructure "
        "physically located in the Republic of Azerbaijan. Cross-border replication or storage "
        "outside Azerbaijan is not permitted without prior written approval."
    )
    pdf.bullet(
        "Confidentiality: mutual NDA is required prior to exchanging non-public system details."
    )
    pdf.body(
        "Out of scope for this initial quotation (do not block the quote on these): "
        "banking-grade / CBAR-specific compliance certifications, formal audit attestations, "
        "and sector-specific regulatory addenda. These may be discussed later if needed."
    )

    pdf.h2("10. Questions for the future (not required now - please comment if available)")
    pdf.bullet("Managed PostgreSQL or dedicated database appliance offerings?")
    pdf.bullet("Managed Redis?")
    pdf.bullet("Object storage (S3-compatible) in the same DC for backups and file uploads?")
    pdf.bullet("Kubernetes / container platform (not needed for Phase 1)?")
    pdf.bullet("Multi-AZ or secondary site for disaster recovery?")
    pdf.bullet("Floating IP / failover IP?")
    pdf.bullet("Can we scale to significantly higher concurrent sessions later on your platform?")

    pdf.h2("11. Deliverables we need in your quotation")
    pdf.bullet(
        "Monthly and setup fees for: Pilot VM (optional), Target VM, Phase 2 data VM, Staging VM (optional)."
    )
    pdf.bullet("Included traffic, IPv4, firewall, snapshots, backups, DDoS - itemized.")
    pdf.bullet("Provisioning lead time.")
    pdf.bullet("Resize policy (CPU/RAM/disk) and any downtime expectations.")
    pdf.bullet("Confirmation that Docker Compose production workloads are supported.")
    pdf.bullet(
        "Written confirmation that all production compute and primary data storage are physically in Azerbaijan "
        "(facility name)."
    )
    pdf.bullet("NDA: your template or confirmation that you will sign ours (required before detailed handoff).")
    pdf.bullet("Data center name / address class (city) and uptime SLA.")

    pdf.h2("12. Contact / next step")
    pdf.body(
        "Please reply with a written quotation matching sections 3-5 and answers to sections 8 and 10. "
        "We can schedule a short technical call after the quote."
    )
    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.p(
        "Document generated for vendor evaluation. Application architecture details beyond this scope "
        "can be shared under NDA.",
        5,
    )

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
