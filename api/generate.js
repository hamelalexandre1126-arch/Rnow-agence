const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. 
Ton objectif est de générer un itinéraire COMPLET (Jour 1 à ${duree}) pour ${destination}.

CONSIGNES :
- Majuscule en début de chaque phrase.
- JAMAIS de gras (**), JAMAIS de dièses (#), JAMAIS d'astérisques (*).
- Saute une ligne entre chaque point pour aérer.

STRUCTURE :
1. Accueil & Analyse (${budget}€, ${confort}).
2. Pour chaque jour (Jour 1, Jour 2...) :
📍 ACTIVITÉ : [Nom] + description.
💰 RÉSERVATION : [Nom](Lien) ou Accès libre.
🏠 REFUGE RNOW : [Nom] + [Lien].
🍴 TABLE RNOW : [Nom] + [Lien].
🚕 TRANSPORT : [Temps et Coût].
3. Logistique & Conseil local.
  `;

  const promptFinal = type === "initial" 
    ? `Crée un voyage de ${duree} jours à ${destination} pour ${budget}€. Style: ${style}. ${instructionsRnow}`
    : `Modifie cet itinéraire : "${ancienItineraire}" selon : "${feedback}". ${instructionsRnow}`;

  try {
    // SYNTAXE URL CORRIGÉE (Pas de "models/" dans l'URL)
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
            maxOutputTokens: 2500 // On remet une limite raisonnable pour éviter les erreurs de serveur
        }
      })
    });

    const data = await response.json();

    if (data.error) {
        // Si ça met encore quota, c'est qu'il faut vraiment attendre les 60 secondes
        return res.status(200).json({ text: "L'IA est sollicitée. Attendez une minute et réessayez. (" + data.error.message + ")" });
    }

    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "L'IA n'a pas pu répondre. Réessaye.";
    
    // Nettoyage Markdown
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
    
    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique." });
  }
}
