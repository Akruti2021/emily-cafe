export async function sendMail(to: string, subject: string, text: string) {
  console.log(`\n========== OUTGOING EMAIL ==========\nTo: ${to}\nSubject: ${subject}\n\n${text}\n====================================\n`);
}