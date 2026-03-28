const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  let promptFinal = "";

  if (type === "initial") {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Ton but : un itinéraire d'élite, chirurgical et ultra-structuré.

PARAMÈTRES : 
Départ: ${depart} | Destination: ${destination} | Budget: ${budget}€/pers | Style: ${style} | Rythme: ${rythme} | Durée: ${duree} jours dès le ${date}.

STRUCTURE OBLIGATOIRE (TRÈS IMPORTANT) :
1. D'abord, donne un RÉSUMÉ RAPIDE du programme global.
2. Ensuite, pour CHAQUE JOUR (Format date DD/MM/YYYY), détaille précisément dans cet ordre :
📍 L'ACTIVITÉ RNOW : [Nom] + [Pourquoi ce choix].
💰 RÉSERVATION : [Prix exact] + [Lien site officiel ou Lieu].
🏠 TON REFUGE : [Nom], [Adresse complète]. [Point fort] + [Prix/nuit].
🍴 LA TABLE RNOW : [Nom], [Adresse complète]. [Plat signature] + [Budget].
🚕 TRANSPORT : [Trajet], [Mode], [Temps] et [Coût].

CONSIGNES DE STYLE :
- Saute EXACTEMENT UNE LIGNE entre chaque point pour la lisibilité.
- UN SEUL emoji au début de chaque ligne (pas de répétition consécutive).
- PAS d'astérisques (*), PAS de dièses (#). Titres en MAJUSCULES simples.
- Analyse le budget de ${budget}€ pour que tout soit réel.
- Si une section est inutile (ex: pas de vols), ignore-la totalement.
    `;
  } else {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Voici l'itinéraire complet que tu as généré : "${ancienItineraire}"
Le client veut cette modification : "${feedback}"

MISSION : 
Réécris l'INTÉGRALITÉ du voyage avec la même structure : 
1. Résumé rapide. 
2. Détails par jour (📍 Activité, 💰 Réservation, 🏠 Refuge, 🍴 Table, 🚕 Transport).
3. Garde le budget de ${budget}€, les adresses complètes, le format de date européen et l'espacement de UNE LIGNE.
4. ZÉRO symbole markdown (* ou #).
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

    // Sécurité pour éviter l'erreur 'undefined' lors des modifications
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        return res.status(500).json({ text: "Désolé, une erreur est survenue lors de la modification. Réessaie." });
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
