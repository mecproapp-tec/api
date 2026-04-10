export function generateInvoiceHtml(data: any) {
  const { invoice, tenant, customer, vehicle, items } = data;

  return `
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #333;
        }

        .header {
          display: flex;
          align-items: center;
          border-bottom: 2px solid #00bcd4;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }

        .logo {
          width: 80px;
          margin-right: 20px;
        }

        h1 {
          margin: 0;
        }

        .section {
          margin-bottom: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 8px;
          border-bottom: 1px solid #ddd;
        }

        th {
          text-align: left;
        }

        .total {
          text-align: right;
          font-size: 18px;
          font-weight: bold;
        }
      </style>
    </head>

    <body>

      <div class="header">
        <img src="${tenant.logoUrl || ''}" class="logo"/>
        <div>
          <h2>${tenant.name}</h2>
          <p>${tenant.address || ''}</p>
          <p>${tenant.phone || ''}</p>
        </div>
      </div>

      <h1>Fatura #${invoice.number}</h1>

      <div class="section">
        <p><strong>Cliente:</strong> ${customer.name}</p>
        <p><strong>Veículo:</strong> ${vehicle?.model || '-'}</p>
        <p><strong>Placa:</strong> ${vehicle?.plate || '-'}</p>
        <p><strong>Data:</strong> ${invoice.createdAt}</p>
      </div>

      <div class="section">
        <h3>Itens</h3>
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Qtd</th>
              <th>Preço</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>R$ ${item.price}</td>
                <td>R$ ${item.total}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <p class="total">Total: R$ ${invoice.total}</p>

    </body>
  </html>
  `;
}