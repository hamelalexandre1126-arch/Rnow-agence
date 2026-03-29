const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  // Prompt ultra-directif pour éviter les fioritures qui consomment des tokens
  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. 
OBJECTIF : Générer un carnet de voyage COMPLET (Jour 1 à ${duree}) pour ${destination}.

CONSIGNES :
- Majuscule en début de phrase obligatoire.
- JAMAIS de gras (**), JAMAIS de dièses (#).
- Saute une ligne entre chaque point.

STRUCTURE :
1. Accueil & Analyse (${budget}€, ${confort}).
2. Pour chaque jour (Jour 1, Jour 2...) :
📍 ACTIVITÉ : [Nom] + pourquoi c'est top.
💰 RÉSERVATION : [Nom](Lien) ou Accès libre.
🏠 REFUGE RNOW : [Nom] + [Lien].
🍴 TABLE RNOW : [Nom] + [Lien].
🚕 TRANSPORT : [Temps et Coût].
3. Logistique & Conseil local.
  `;

  const promptFinal = type === "initial" 
    ? `Crée un itinéraire de ${duree} jours à ${destination}. Budget: ${budget}€. Style: ${style}. ${instructionsRnow}`
    : `Modifie cet itinéraire : "${ancienItineraire}" selon le feedback : "${feedback}". ${instructionsRnow}`;

  try {
    // Retour sur Flash 1.5 qui est le plus robuste pour ton quota
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { 
            temperature: 0.7,
            topP: 0.8,
            topK: 40
            // On ne met pas de maxOutputTokens pour laisser l'IA finir sa phrase
        }
      })
    });

    const data = await response.json();

    if (data.error) {
        return res.status(200).json({ text: "Quota atteint. Attendez 60 secondes pile et réessayez. " + data.error.message });
    }

    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "L'IA a eu un petit bug. Réessayez.";
    
    // Nettoyage des symboles Markdown
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
    
    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur serveur." });
  }
}
