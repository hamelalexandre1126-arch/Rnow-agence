const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { destination, budget, style, date, duree, hebergement } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API absente de Vercel." });

  const promptFinal = `Crée un voyage Rnow pour ${destination} (${duree} jours). Budget: ${budget}€. Style: ${style}. Détaille tout selon mes 11 points.`;

  try {
    // 1. ON DEMANDE À GOOGLE QUEL MODÈLE TA CLÉ PEUT UTILISER
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    
    // On cherche un modèle qui supporte "generateContent"
    const model = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent"));
    
    if (!model) {
      return res.status(500).json({ text: "Google ne propose aucun modèle pour ta clé au Mexique." });
    }

    // 2. ON UTILISE LE MODÈLE TROUVÉ (ex: gemini-1.5-flash ou gemini-pro)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ text: "Erreur Google : " + data.error.message });
    }

    const textOutput = data.candidates[0].content.parts[0].text;
    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(500).json({ text: "Erreur : " + error.message });
  }
}
