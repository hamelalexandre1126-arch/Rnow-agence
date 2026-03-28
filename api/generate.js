const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  let promptFinal = "";

  if (type === "initial") {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Ton but : un itinéraire d'élite, chirurgical, ultra-précis et parfaitement structuré.
PARAMÈTRES : Départ: ${depart} | Destination: ${destination} | Budget: ${budget}€/pers | Style: ${style} | Rythme: ${rythme} | Durée: ${duree} jours dès le ${date}.
RÈGLES DE FORME :
- DATE : Format Européen (ex: 19/06/2026).
- ESPACEMENT : Saute EXACTEMENT UNE LIGNE entre chaque point (📍, 💰, 🏠, 🍴, 🚕).
- ÉMOJIS : Un SEUL emoji au début de chaque ligne. INTERDICTION de répéter le même sur deux lignes consécutives.
- PAS d'astérisques (*), PAS de dièses (#). Titres en MAJUSCULES simples uniquement.
CONTENU CHIRURGICAL : Vols RÉELS, Programme Jour par Jour, Activités précises, Réservations avec prix exacts et sites officiels, Hébergement avec ADRESSE COMPLÈTE, Resto avec ADRESSE COMPLÈTE, Transport précis, Assurances, Location et Conseil d'initié.
IMPORTANT : Si une section est inutile, ne la cite pas.
    `;
  } else {
    // --- PROMPT DE CORRECTION RENFORCÉ ---
    promptFinal = `
Tu es l'Expert-Concierge Rnow. 
Voici l'itinéraire actuel que tu as généré : 
"${ancienItineraire}"

Le client souhaite cette modification précise : "${feedback}"

TA MISSION : 
Réécris l'intégralité du voyage en intégrant ce changement. 
CONSERVE TOUTE LA RIGUEUR : Adresses complètes, prix réels, budget de ${budget}€, format de date européen, et l'espacement de UNE LIGNE entre chaque point. 
Reste chirurgical et n'utilise aucun symbole (* ou #).
    `;
  }

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    const model = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent") && (m.name.includes("flash") || m.name.includes("pro"))) || listData.models?.[0];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptFinal }] }] })
    });

    const data = await response.json();

    // --- SÉCURITÉ AJOUTÉE ICI POUR ÉVITER L'ERREUR 'UNDEFINED' ---
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        console.error("Erreur API Gemini:", data);
        return res.status(500).json({ text: "L'IA n'a pas pu traiter la modification. Réessaie avec une demande plus précise." });
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
