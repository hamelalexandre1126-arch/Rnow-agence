export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { destination, budget, style, date, duree, hebergement } = req.body;

  const promptFinal = `
Tu es un agent professionnel d’une agence de voyage spécialisée dans l’organisation de séjours sur mesure nommée Rnow.
Ta mission est de concevoir un voyage complet et entièrement organisé.

MES 11 RÈGLES D'OR :
1. Utilise les infos suivantes : Destination: ${destination}, Budget: ${budget}€, Style: ${style}, Date: ${date}, Durée: ${duree} jours, Hébergement: ${hebergement}.
2. Organise tout de A à Z (transports, logements, activités, assurances, budget global).
3. Les prix doivent être RÉALISTES et VÉRIFIÉS.
4. Programme JOUR PAR JOUR HYPER DÉTAILLÉ avec horaires.
5. Détails OBLIGATOIRES pour chaque activité (Nom, adresse, prix, durée, accès, site web).
6. Détails précis sur les transports locaux.
7. Détails précis sur l'hébergement (Nom, prix, avis).
8. 1 restaurant AUTHENTIQUE par jour (pas d'attrape-touriste).
9. Présente plusieurs options d'assurance voyage.
10. Option location de voiture si pertinente.
11. Niveau de détail HYPER ÉLEVÉ. Le client ne doit rien avoir à chercher.

INTERDICTIONS : 
- NE JAMAIS UTILISER DE TABLEAUX. Format texte uniquement.
- NE PAS DONNER D'ESTIMATIONS VAGUES pour les vols et logements : tu dois te baser sur les tarifs actuels pour les dates du ${date}.

A la fin, ajoute la rubrique « Mes conseils voyages » avec des conseils locaux exclusifs.
Écris autant que nécessaire, sans limite de longueur.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }]
      })
    });

    const data = await response.json();
    const textOutput = data.candidates[0].content.parts[0].text;
    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la génération du voyage." });
  }
}
