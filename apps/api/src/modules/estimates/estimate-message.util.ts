export function buildEstimateMessage(estimate: any, pdfUrl?: string) {
  const title = `Orçamento #${estimate.id}`;

  const text = `📄 ${title}

👤 Cliente: ${estimate.client?.name || '-'}

💰 Total: R$ ${Number(estimate.total).toFixed(2)}

${pdfUrl ? `👉 Acesse o PDF:\n${pdfUrl}\n` : ''}

Obrigado pela preferência!
MecPro`;

  return {
    title,
    text,
    encoded: encodeURIComponent(text),
  };
}