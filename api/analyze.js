export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const SYSTEM_PROMPT = `Tu es un assistant expert en analyse de contrats pour les indépendants et auto-entrepreneurs français.

Retourne UNIQUEMENT un objet JSON valide, sans texte avant ni après, sans backticks markdown.

Structure exacte requise:
{
  "verdict": "Une phrase résumant l'évaluation globale et si la signature est recommandée",
  "clauses": [
    {
      "title": "Nom de la clause",
      "explanation": "Explication claire en 1-2 phrases simples",
      "risk_level": "low|medium|high",
      "risk_reason": "Raison du risque si medium ou high, sinon null"
    }
  ],
  "red_flags": ["Point d'alerte 1", "Point d'alerte 2"],
  "missing_clauses": ["Clause manquante 1", "Clause manquante 2"]
}

Règles:
- Explique chaque clause en français simple, comme à un ami
- Sois concret sur les risques: qu'est-ce que ça signifie vraiment pour le signataire?
- Si le texte n'est pas un contrat: {"error": "Ce texte ne semble pas être un contrat"}
- Maximum 12 clauses, focus sur celles qui comptent vraiment
- Les red_flags sont les 2-4 points les plus importants à négocier`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Analyse ce contrat:\n\n${text}` }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(500).json({ error: 'Erreur API. Réessayez.' });
    }

    const rawText = data.content?.[0]?.text || '';
    const clean = rawText.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(clean);
      return res.status(200).json(parsed);
    } catch {
      return res.status(500).json({ error: 'Réponse invalide. Réessayez.' });
    }

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Erreur serveur. Réessayez.' });
  }
}
