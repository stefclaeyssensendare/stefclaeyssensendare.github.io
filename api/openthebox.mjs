// api/openthebox.mjs

export default async function handler(req, res) {
  const vat = (req.query.vat || "").toUpperCase();
  if (!vat || !/^BE\d{10}$/.test(vat)) {
    res.status(400).json({ error: "Invalid VAT number" });
    return;
  }

  const baseUrl = "https://openthebox.be/api/companies";

  try {
    // Fetch company data
    let company = null;
    try {
      const companyRes = await fetch(`${baseUrl}/${vat}`);
      if (!companyRes.ok) {
        const text = await companyRes.text().catch(() => "");
        res
          .status(companyRes.status)
          .json({ error: `Company fetch failed: ${text}` });
        return;
      }
      company = await companyRes.json().catch(() => null);
    } catch (err) {
      console.error("Error fetching company:", err);
      res.status(500).json({ error: "Failed to fetch company data" });
      return;
    }

    // Fetch annual accounts
    let annualAccounts = null;
    try {
      const accountsRes = await fetch(
        `${baseUrl}/${vat}/annual-accounts/most-recent`
      );
      if (!accountsRes.ok) {
        const text = await accountsRes.text().catch(() => "");
        res
          .status(accountsRes.status)
          .json({ error: `Accounts fetch failed: ${text}` });
        return;
      }
      annualAccounts = await accountsRes.json().catch(() => null);
    } catch (err) {
      console.error("Error fetching accounts:", err);
      res.status(500).json({ error: "Failed to fetch annual accounts" });
      return;
    }

    res.status(200).json({ company, annualAccounts });
  } catch (err) {
    console.error("Unexpected error in /api/openthebox:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
