const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. Tu dois ABSOLUMENT finir ta réponse par "FIN DU CARNET".
Génère un itinéraire complet du jour 1 au jour ${duree}.

RÈGLES : 
- Majuscule en début de phrase. 
- Pas de gras (**), pas de dièses (#). 
- Saute une ligne entre chaque puce.

STRUCTURE :
1. ACCUEIL ET ANALYSE (${budget}€, ${confort})
2. ITINÉRAIRE (JOUR 1 À ${duree}) :
📍 ACTIVITÉ : [Nom]
💰 RÉSERVATION : [Lien] ou Accès libre
🏠 REFUGE RNOW : [Nom] + [Lien]
🍴 TABLE RNOW : [Nom] + [Lien]
🚕 TRANSPORT : [Infos]
3. LOGISTIQUE ET CONSEIL D'INITIÉ
  `;

  const promptFinal = type === "initial" 
    ? `Crée un voyage COMPLET de ${duree} jours au ${destination} pour ${budget}€. ${instructionsRnow}`
    : `Modifie cet itinéraire : "${ancienItineraire}" avec ce changement : "${feedback}". ${instructionsRnow}`;

  try {
    // ON PASSE SUR LE MODÈLE PRO POUR PLUS DE STABILITÉ
    const modelName = "models/gemini-1.5-pro"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;

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
            maxOutputTokens: 3500 // On pousse au max
        }
      })
    });

    const data = await response.json();
    
    // Si le modèle Pro n'est pas dispo, on rechute sur Flash automatiquement
    if (data.error) {
        return res.status(200).json({ text: "Désolé, l'IA sature un peu. Réessayez dans 30 secondes ou réduisez la durée du voyage." });
    }

    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur de génération.";
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
    
    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur serveur." });
  }
}
