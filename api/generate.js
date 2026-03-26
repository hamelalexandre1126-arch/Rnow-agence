const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { destination, budget, style, date, duree, hebergement } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  // --- TON PROMPT ORIGINAL ET ULTRA-PRÉCIS ---
  const promptFinal = `
Tu es un agent professionnel d’une agence de voyage spécialisée dans l’organisation de séjours sur mesure nommée Rnow.
Ta mission est de concevoir un voyage complet et entièrement organisé pour des clients.

1. Utilisation des informations :
Tu dois utiliser toutes les informations fournies : Destination: ${destination}, Budget: ${budget}€, Style: ${style}, Date: ${date}, Durée: ${duree} jours, Hébergement: ${hebergement}.
Tu n’as pas le droit d’inventer ou de supposer des informations. Si certaines informations sont manquantes, signale-le.

2. Organisation du voyage :
Ton rôle est d’organiser le voyage de A à Z (transports internationaux, transports locaux, hébergements, activités, restauration, recommandations locales, assurances, conseils pratiques, estimation du budget global). Rien ne doit être laissé au hasard.

3. Vérification des informations et des prix :
Tous les prix indiqués doivent être réalistes et vérifiés sur internet pour les dates du ${date}. Précise ce qui est inclus et non inclus.

4. Structure du programme :
Produis un programme JOUR PAR JOUR EXTRÊMEMENT DÉTAILLÉ. Chaque journée doit inclure horaires indicatifs, temps de transport, activités prévues, temps libres et conseils.

5. Activités :
Pour chaque activité, indique OBLIGATOIREMENT : nom précis, description, adresse, prix, durée, comment s’y rendre, temps de trajet, réservation nécessaire et site officiel.

6. Transports locaux :
Précise le mode de transport, où le prendre, temps de trajet, prix estimé, où acheter les billets et le niveau de fiabilité.

7. Hébergement :
Indique nom, adresse, prix par nuit, type de chambre, avantages, distance des activités et avis général.

8. Restaurants et vie locale :
À la fin de chaque journée, propose 1 restaurant local authentique (nom, adresse, prix moyen, spécialités). Pas d'attrape-touriste.

9. Assurance voyage :
Présente plusieurs options d’assurance (nom, couverture, prix estimé, cas recommandé).

10. Location de voiture :
Si pertinente, indique nom de la compagnie, prix estimé, conditions, assurance et conseils pratiques.

11. Niveau de détail attendu :
Le programme doit être HYPER DÉTAILLÉ. Le client doit recevoir un voyage clé en main.

CONSIGNES DE STYLE STRICTES :
- INTERDICTION d'utiliser des astérisques (**).
- INTERDICTION d'utiliser des dièses (#).
- INTERDICTION d'utiliser des tableaux.
- Utilise uniquement des sauts de ligne et des MAJUSCULES pour les titres.
- Termine par une rubrique « MES CONSEILS VOYAGES » avec des astuces locales.
  `;

  try {
    // Détection auto du modèle pour garantir le fonctionnement au Mexique
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    const model = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent"));
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }]
      })
    });

    const data = await response.json();
    let textOutput = data.candidates[0].content.parts[0].text;

    // Nettoyage final pour être sûr qu'aucun symbole ne passe
    textOutput = textOutput.replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
