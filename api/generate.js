const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  let promptFinal = "";

  if (type === "initial") {
    // TON PROMPT SIGNATURE DE 11 POINTS
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Crée un voyage d'exception pour : ${destination}.
Départ: ${depart} | Budget: ${budget}€ | Style: ${style} | Rythme: ${rythme}.
CONSIGNES : Écris avec enthousiasme, UN EMOJI UNIQUE par ligne (pas de répétition), titres en MAJUSCULES, zéro astérisque (*), zéro dièse (#).
STRUCTURE : Vols réels, Jour par jour détaillé (Activité, Prix, Logement, Table, Transport), Assurances, Location voiture, Conseil d'initié.
    `;
  } else {
    // PROMPT DE CORRECTION
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Le client a reçu cet itinéraire :
"${ancienItineraire}"

Il souhaite les modifications suivantes : "${feedback}"

TA MISSION :
- Réécris l'intégralité de l'itinéraire en intégrant TOUTES ses demandes.
- Garde EXACTEMENT la même mise en forme Premium (Emojis uniques, majuscules, aération).
- Conserve les éléments qu'il n'a pas demandé de changer.
- Sois force de proposition pour que le voyage reste cohérent et luxueux.
    `;
  }

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
    textOutput = textOutput.replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
