const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  let promptFinal = "";

  if (type === "initial") {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Ton but : concevoir un voyage de A à Z avec une précision chirurgicale. Pas de blabla, que du concret.

PARAMÈTRES CLIENT : 
- Ville de départ : ${depart}
- Destination : ${destination}
- Budget : ${budget}€/personne (ANALYSE CE BUDGET RÉELLEMENT)
- Style : ${style} | Rythme : ${rythme}
- Dates : Du ${date} pour ${duree} jours.

VÉRIFICATION DES 11 POINTS (OBLIGATOIRE) :

1. VOLS : Si nécessaire, donne les vols Allers/Retours RÉELS (Compagnies, Horaires exacts, Escales).
2. PROGRAMME : Un planning détaillé du Jour 1 au Jour ${duree}.
3. ACTIVITÉS : Noms précis, descriptions et expertise (pourquoi c'est le meilleur choix ?).
4. RÉSERVATIONS : Prix exacts en € et noms des SITES OFFICIELS ou lieux d'achat.
5. HÉBERGEMENT : Nom de l'établissement, ADRESSE COMPLÈTE, atout unique et prix/nuit.
6. RESTAURATION : Nom du restaurant, ADRESSE COMPLÈTE, budget moyen et plat typique.
7. TRANSPORT : Trajets précis, mode de transport (varie les emojis), temps et coûts.
8. BUDGET : Assure-toi que tout (vols + vie + dodo) rentre dans les ${budget}€.
9. ASSURANCES : Propose 2 options d'assurance voyage chiffrées.
10. LOCATION : Détails précis (modèle, prix, compagnie) si pertinent.
11. CONSEIL D'INITIÉ : Une astuce de local que personne d'autre ne donne.

RÈGLES DE STYLE RNOW :
- DATES : Format Européen (ex: 19/06/2026).
- LISIBILITÉ : Saute DEUX LIGNES entre chaque point (📍, 💰, 🏠, 🍴, 🚕).
- ÉMOJIS : Un SEUL emoji au début de chaque ligne. INTERDICTION de répéter le même sur deux lignes consécutives.
- PAS d'astérisques (*), PAS de dièses (#). Titres en MAJUSCULES simples.
- ZÉRO COMMENTAIRE : Si une section est inutile, ne la cite pas. Ne justifie rien.
    `;
  } else {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Modifie cet itinéraire : "${ancienItineraire}" selon ce feedback : "${feedback}".
RESTE CHIRURGICAL. Garde la précision, le budget de ${budget}€, les dates au format européen et la règle : UN EMOJI DIFFÉRENT PAR LIGNE avec double saut de ligne.
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
    
    // Nettoyage radical des résidus Markdown
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
