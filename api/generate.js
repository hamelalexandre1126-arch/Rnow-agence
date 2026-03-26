const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { destination, budget, style, date, duree, hebergement } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ text: "Erreur : La clé API est manquante dans Vercel." });
  }

  // --- TON PROMPT DE 11 POINTS INTÉGRAL ---
  const promptFinal = `
Tu es un agent professionnel d’une agence de voyage spécialisée dans l’organisation de séjours sur mesure nommée Rnow.
Ta mission est de concevoir un voyage complet et entièrement organisé pour des clients.

1. Utilisation des informations :
Utilise Destination: ${destination}, Budget: ${budget}€, Style: ${style}, Date: ${date}, Durée: ${duree} jours, Hébergement: ${hebergement}.
N'invente rien. Si une info manque, signale-le.

2. Organisation du voyage :
Organise tout de A à Z (transports internationaux, locaux, hébergements, activités, restauration, recommandations locales, assurances, conseils pratiques, budget global).

3. Vérification des informations et des prix :
Tous les prix indiqués doivent être réalistes et vérifiés sur internet pour les dates demandées. Précise ce qui est inclus et non inclus.

4. Structure du programme :
Produis un programme JOUR PAR JOUR EXTRÊMEMENT DÉTAILLÉ avec horaires, temps de transport et conseils.

5. Activités :
Indique OBLIGATOIREMENT : nom précis, description, adresse, prix, durée, accès, réservation nécessaire et site officiel.

6. Transports locaux :
Précise le mode, où le prendre, temps de trajet, prix estimé et où acheter les billets.

7. Hébergement :
Indique nom, adresse, prix par nuit, type de chambre, avantages et distance des activités.

8. Restaurants et vie locale :
Propose 1 restaurant AUTHENTIQUE par jour (nom, adresse, prix, spécialité). Pas d'attrape-touriste.

9. Assurance voyage :
Présente plusieurs options d’assurance précises.

10. Location de voiture :
Si pertinente, indique compagnie, prix estimé et conseils.

11. Niveau de détail attendu :
Le programme doit être HYPER DÉTAILLÉ et clé en main.

RÈGLES STRICTES :
- NE JAMAIS UTILISER DE TABLEAUX (Format texte uniquement).
- OBLIGATION de donner des prix réels pour les vols et logements aux dates souhaitées.
- Termine par une rubrique « Mes conseils voyages » avec des conseils locaux exclusifs.
- Pas de limite de longueur, écris autant que nécessaire.
  `;

  try {
    // UTILISATION DU MODÈLE GEMINI-PRO (Plus stable pour l'API v1beta)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ text: "Erreur Google : " + data.error.message });
    }

    if (!data.candidates || !data.candidates[0].content) {
      return res.status(500).json({ text: "L'IA n'a pas pu répondre. Réessaie avec une autre destination." });
    }

    const textOutput = data.candidates[0].content.parts[0].text;
    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
