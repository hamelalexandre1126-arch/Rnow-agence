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

PARAMÈTRES : 
Départ: ${depart} | Destination: ${destination} | Budget: ${budget}€/pers | Style: ${style} | Rythme: ${rythme} | Durée: ${duree} jours dès le ${date}.

RÈGLES DE FORME (PRÉCISION ET LISIBILITÉ) :
- DATE : Format Européen (ex: Vendredi 19/06/2026).
- ESPACEMENT : Saute EXACTEMENT UNE LIGNE entre chaque point (📍, 💰, 🏠, 🍴, 🚕). Pas de blocs compacts, mais pas de vide excessif non plus.
- STRUCTURE : Pour chaque jour, commence par le titre du jour, puis liste les catégories dans l'ordre.
- ÉMOJIS : Un SEUL emoji au début de chaque ligne. INTERDICTION de répéter le même sur deux lignes consécutives.
- PAS d'astérisques (*), PAS de dièses (#). Titres en MAJUSCULES simples uniquement.

CONTENU CHIRURGICAL (11 POINTS) :
1. VOLS : Si nécessaire, vols A/R RÉELS (Compagnies, Horaires, Escales) inclus dans le budget de ${budget}€.
2. PROGRAMME : Détail du Jour 1 au Jour ${duree}.
3. ACTIVITÉS : Noms précis + expertise détaillée (pourquoi ce choix ?).
4. RÉSERVATIONS : Prix exacts en € + liens SITES OFFICIELS ou lieux d'achat.
5. HÉBERGEMENT : Nom, ADRESSE COMPLÈTE, atout unique et prix/nuit.
6. RESTAURATION : Nom du resto, ADRESSE COMPLÈTE, budget moyen et plat signature.
7. TRANSPORT : Trajets précis, mode (varie les emojis), temps et coûts.
8. BUDGET : Analyse stricte pour que tout rentre dans les ${budget}€.
9. ASSURANCES : 2 options chiffrées adaptées.
10. LOCATION : Détails complets si pertinent (modèle, prix, compagnie).
11. CONSEIL D'INITIÉ : Le secret de local qui fait la différence.

IMPORTANT : Si une section est inutile (ex: pas de vols), ne la cite pas et ne fais aucun commentaire.
    `;
  } else {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Modifie cet itinéraire : "${ancienItineraire}" selon : "${feedback}".
RESTE CHIRURGICAL. Garde la structure précise, le budget de ${budget}€, les dates européennes et un espacement de une ligne entre chaque point.
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
    let textOutput = data.candidates[0].content.parts[0].text;
    
    // Nettoyage final
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
