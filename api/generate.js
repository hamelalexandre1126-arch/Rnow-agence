const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  let promptFinal = "";

  if (type === "initial") {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Ton ton est jeune, dynamique et ultra-professionnel.

MISSION DANS CET ORDRE PRÉCIS :

1. ACCUEIL : Salue le client avec l'énergie Rnow.
2. ANALYSE EXPERTE : Fais un paragraphe (4 lignes) pour commenter ses critères (Destination: ${destination}, Budget: ${budget}€, Envies: ${style}). Explique pourquoi c'est un excellent choix et comment tu as personnalisé le voyage.
3. PROGRAMME RÉSUMÉ : Liste chaque jour (Jour 1, Jour 2...) avec juste le titre de l'étape pour donner une vue d'ensemble rapide.
4. DÉTAILS CHIRURGICAUX : Pour chaque jour (Format Date DD/MM/YYYY), détaille :
📍 L'ACTIVITÉ RNOW : [Nom] + [Expertise : pourquoi ce choix correspond à "${style}"].
💰 RÉSERVATION : [Prix exact] + [Lien site officiel ou lieu précis].
🏠 TON REFUGE : [Nom], [ADRESSE COMPLÈTE]. [Atout unique] + [Prix/nuit].
🍴 LA TABLE RNOW : [Nom], [ADRESSE COMPLÈTE]. [Plat signature] + [Budget].
🚕 TRANSPORT : [Trajet], [Mode (varie les emojis)], [Temps] et [Coût].
5. LE CONSEIL D'INITIÉ : Termine par une astuce de local exclusive (lieu secret, meilleur moment pour une vue, etc.).

CONSIGNES DE FORME :
- DATE : Format Européen (ex: 28/03/2026).
- ESPACEMENT : Saute EXACTEMENT UNE LIGNE entre chaque puce d'information (📍, 💰, etc.).
- ÉMOJIS : Un SEUL emoji au début de chaque ligne. NE JAMAIS répéter le même emoji sur deux lignes qui se suivent.
- PAS d'astérisques (*), PAS de dièses (#). Titres en MAJUSCULES simples.
- BUDGET : Tout doit être inclus dans les ${budget}€.
    `;
  } else {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Modifie cet itinéraire : "${ancienItineraire}" selon : "${feedback}".
MISSION : Réécris l'INTÉGRALITÉ avec la structure Accueil > Analyse > Résumé > Détails par jour > Conseil d'Initié.
Règles : Dates DD/MM/YYYY, une ligne d'espace, émojis variés, zéro symbole (* ou #).
    `;
  }

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    const model = listData.models?.find(m => m.name.includes("pro") || m.name.includes("flash")) || listData.models?.[0];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptFinal }] }] })
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error("Réponse vide de l'IA");
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
