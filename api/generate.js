const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { depart, destination, budget, style, date, duree, hebergement, rythme } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const promptFinal = `
Tu es l'expert Rnow. Crée un carnet de voyage ultra-dynamique pour : ${destination}.
Départ: ${depart} | Budget: ${budget}€ | Style: ${style} | Rythme: ${rythme}.

STYLE DE RÉDACTION :
- Style "Magazine de voyage" : percutant, frais, donne envie !
- Pas de longs paragraphes. Uniquement des lignes courtes.
- UTILISE UN EMOJI AU DÉBUT DE CHAQUE LIGNE pour créer une liste visuelle.

STRUCTURE OBLIGATOIRE POUR CHAQUE JOUR :

JOUR X : NOM DE L'ÉTAPE 
📍 ACTIVITÉ : [Nom + description courte]
🏠 LOGEMENT : [Nom + pourquoi c'est top]
🍴 RESTO : [Le spot local à ne pas rater]
💰 BUDGET : [Estimation du jour]
🔗 LIEN : https://en.pons.com/translate/french-english/officielle

CONSIGNES STRICTES :
- Chaque nouvelle info doit commencer par un emoji.
- Double saut de ligne entre chaque section.
- ZÉRO ASTÉRISQUE (*), ZÉRO DIÈSE (#).
- FINIS PAR : 💡 MES CONSEILS VOYAGES (3 astuces flash).

Points à inclure : Vols depuis ${depart}, transports locaux, assurances et location voiture si besoin (${rythme}).
  `;

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    const model = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent"));
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptFinal }] }] })
    });

    const data = await response.json();
    let textOutput = data.candidates[0].content.parts[0].text;

    // NETTOYAGE FINAL
    textOutput = textOutput.replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
