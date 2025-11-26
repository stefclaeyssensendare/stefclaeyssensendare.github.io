import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const vat = (req.query.vat as string)?.toUpperCase();
  if (!vat || !/^BE\d{10}$/.test(vat)) {
    res.status(400).json({ error: "Invalid VAT number" });
    return;
  }

  const baseUrl = "https://openthebox.be/api/companies";

  try {
    const [companyRes, accountsRes] = await Promise.all([
      fetch(`${baseUrl}/${vat}`),
      fetch(`${baseUrl}/${vat}/annual-accounts/most-recent`),
    ]);

    if (!companyRes.ok) {
      const text = await companyRes.text().catch(() => "");
      res
        .status(companyRes.status)
        .json({ error: `Company fetch failed: ${text}` });
      return;
    }

    if (!accountsRes.ok) {
      const text = await accountsRes.text().catch(() => "");
      res
        .status(accountsRes.status)
        .json({ error: `Accounts fetch failed: ${text}` });
      return;
    }

    const company = await companyRes.json().catch(() => null);
    const annualAccounts = await accountsRes.json().catch(() => null);

    res.status(200).json({ company, annualAccounts });
  } catch (err: any) {
    res.status(500).json({ error: String(err) });
  }
}
