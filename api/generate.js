const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { depart, destination, budget, style, date, duree, hebergement, rythme } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const promptFinal = `
Tu es l'Expert-Concierge de l'agence Rnow. Ton client attend des ordres de mission précis, pas des suggestions vagues.
Départ: ${depart} | Destination: ${destination} | Budget: ${budget}€ | Style: ${style} | Rythme: ${rythme}.

RÈGLES D'OR DE RÉDACTION :
- INTERDICTION de dire "cherchez une agence locale", "voyez avec votre hôtel" ou "selon vos préférences".
- Tu DOIS choisir LE meilleur prestataire, LE meilleur restaurant et LE meilleur trajet.
- Chaque info doit être exploitable immédiatement par le client (Nom + Adresse + Prix).

STRUCTURE SCANABLE POUR CHAQUE JOUR :

JOUR X : [NOM DE L'ÉTAPE]
📍 L'ACTIVITÉ RNOW : [Nom précis de l'endroit/excursion]. [Description courte de pourquoi c'est LE meilleur choix de la région].
💰 PRIX & RÉSA : [Prix exact en €]. Réservez sur [Nom du site officiel]. Si pas de site, indique : "Achat du billet sur place à [Lieu précis]".
🏠 TON REFUGE : [Nom de l'hôtel/Airbnb], [Adresse complète]. [Point fort unique]. Prix: [Montant/nuit].
🍴 LA TABLE RNOW : [Nom du resto], [Adresse]. Commande impérativement : [Nom du plat typique]. Budget: [Prix moyen].
🚕 TRANSPORT : [Le trajet précis : ex "Taxi de A vers B" ou "Bus ligne 12"]. Coût: [Prix].

CONSIGNES DE SÉCURITÉ :
- Si tu proposes un lien, il doit être RÉEL et vérifié (ex: Tripadvisor, GetYourGuide, ou Site Officiel). Pas de liens génériques.
- Inclus les vols réels depuis ${depart} dans le calcul.
- ZÉRO ASTÉRISQUE (*), ZÉRO DIÈSE (#).
- Finis par : 💡 LE CONSEIL D'INITIÉ (Une astuce de local que personne ne connaît).
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

    // NETTOYAGE RADICAL
    textOutput = textOutput.replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
