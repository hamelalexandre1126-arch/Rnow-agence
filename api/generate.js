const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  let promptFinal = "";

  if (type === "initial") {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Ton ton est jeune, dynamique et passionné. 

IMPORTANT : Les envies du client sont : "${style}". Tu DOIS construire tout l'itinéraire en fonction de ces goûts spécifiques. Si le client veut de la gastronomie, chaque étape doit être gourmande. S'il veut de l'aventure, chaque activité doit être intense.

MISSION : 
1. ACCUEIL : Salue le client avec l'énergie Rnow. 
2. ANALYSE PERSONNALISÉE : Fais un paragraphe (4 lignes) où tu analyses précisément ses envies ("${style}") et son budget (${budget}€). Explique-lui comment tu as adapté le voyage à ses goûts personnels.
3. RÉSUMÉ : Aperçu rapide du programme.
4. DÉTAIL CHIRURGICAL : Programme jour par jour.

PARAMÈTRES : 
Départ: ${depart} | Destination: ${destination} | Budget: ${budget}€/pers | Goûts & Envies: ${style} | Rythme: ${rythme} | Durée: ${duree} jours dès le ${date}.

STRUCTURE PAR JOUR (FORMAT EUROPÉEN DD/MM/YYYY) :
📍 L'ACTIVITÉ RNOW : [Nom] + [Expertise Rnow : pourquoi ce choix correspond exactement à ses envies de "${style}"].

💰 RÉSERVATION : [Prix exact] + [Lien site officiel ou lieu précis].

🏠 TON REFUGE : [Nom], [ADRESSE COMPLÈTE]. [Pourquoi cet hôtel plaira au client] + [Prix/nuit].

🍴 LA TABLE RNOW : [Nom], [ADRESSE COMPLÈTE]. [Plat signature] + [Budget moyen].

🚕 TRANSPORT : [Trajet], [Mode], [Temps] et [Coût].

CONSIGNES DE FORME :
- DATE : Format européen (ex: Samedi 28/03/2026).
- ESPACEMENT : Saute EXACTEMENT UNE LIGNE entre chaque puce (📍, 💰, etc.).
- ÉMOJIS : Un SEUL emoji au début de chaque ligne. NE JAMAIS répéter le même emoji sur deux lignes qui se suivent.
- PAS d'astérisques (*), PAS de dièses (#). Titres en MAJUSCULES simples.
- BUDGET : Tout doit rentrer dans l'enveloppe de ${budget}€.
    `;
  } else {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Reprends cet itinéraire : "${ancienItineraire}"
Le client souhaite ajuster ceci : "${feedback}"

MISSION : 
Réécris l'INTÉGRALITÉ. Garde ton expertise et l'accent sur ses goûts initiaux ("${style}"). 
Structure : Accueil > Analyse du changement > Résumé > Détails par jour.
Règles : Dates DD/MM/YYYY, une ligne d'espace, émojis variés, zéro symbole (* ou #).
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

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        return res.status(500).json({ text: "Erreur technique de l'expert. Réessaie !" });
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
