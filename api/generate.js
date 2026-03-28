const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { depart, destination, budget, style, date, duree, hebergement, rythme } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const promptFinal = `
Tu es l'expert de l'agence Rnow. Crée un carnet de voyage d'exception pour : ${destination}.
Départ: ${depart} | Budget: ${budget}€ | Style: ${style} | Rythme: ${rythme}.

STYLE DE RÉDACTION :
- Dynamique, aéré, chaque info commence par un EMOJI.
- Pas de longs textes inutiles. Allez droit au but mais avec TOUS les détails techniques.

STRUCTURE OBLIGATOIRE POUR CHAQUE JOUR :

JOUR X : [NOM DE L'ÉTAPE]
📍 ACTIVITÉ : [Nom de l'excursion]. [Description précise de l'expérience].
💰 COÛT & RÉSERVATION : [Prix exact en €] par personne. Réserver sur [Nom du site officiel ou plateforme].
🏠 LOGEMENT : [Nom de l'hôtel/Airbnb], [Adresse précise]. Pourquoi ce choix ? [Argument phare].
🍴 DÉJEUNER/DÎNER : [Nom du resto], [Adresse]. Le plat à ne pas rater : [Plat].
🔗 LIEN OFFICIEL : [Mets UNIQUEMENT l'URL directe de l'activité ou de l'hôtel. Si tu n'es pas sûr de l'URL exacte, ne mets rien ou indique : "À réserver sur place"].

RÈGLES CRUCIALES :
- Ne mets JAMAIS de liens vers des traducteurs ou des sites génériques. On veut du spécifique.
- Inclus les détails des vols réels depuis ${depart} pour le ${date} dans le budget global.
- Précise les transports entre chaque étape (prix du taxi, bus ou location voiture).
- ZÉRO ASTÉRISQUE (*), ZÉRO DIÈSE (#).
- FINIS PAR : 💡 MES CONSEILS VOYAGES (3 astuces locales inédites).
  `;

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

    // NETTOYAGE DES SYMBOLES
    textOutput = textOutput.replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
