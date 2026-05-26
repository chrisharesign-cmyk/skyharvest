// ── Sky Harvest Workflow Store ─────────────────────────────────────────────────
// Simple pub/sub state store — no React dependency
// Shared across OrderInbox, HarvestRuns, PickList, DeliveryRuns

const PRODUCTS = [
  {name:"Arugula (S)",wt:28,family:"Arugula"},{name:"Arugula (M)",wt:68,family:"Arugula"},
  {name:"Kale (S)",wt:42,family:"Kale"},{name:"Kale (M)",wt:78,family:"Kale"},
  {name:"Cilantro (S)",wt:22,family:"Cilantro"},{name:"Cilantro (M)",wt:53,family:"Cilantro"},
  {name:"Red Radish (S)",wt:42,family:"Radish"},{name:"Red Radish (M)",wt:98,family:"Radish"},{name:"Red Radish (L)",wt:228,family:"Radish"},
  {name:"Mellow Mix (S)",wt:47,family:"Mellow Mix"},{name:"Mellow Mix (M)",wt:88,family:"Mellow Mix"},{name:"Mellow Mix (L)",wt:208,family:"Mellow Mix"},
  {name:"Spicy Mix (S)",wt:47,family:"Spicy Mix"},{name:"Spicy Mix (M)",wt:98,family:"Spicy Mix"},{name:"Spicy Mix (L)",wt:228,family:"Spicy Mix"},
  {name:"Radish Blend (S)",wt:47,family:"Radish Blend"},{name:"Radish Blend (M)",wt:98,family:"Radish Blend"},{name:"Radish Blend (L)",wt:238,family:"Radish Blend"},
  {name:"Salad Boost (M)",wt:98,family:"Salad Boost"},
  {name:"Sunflower Shoots (M)",wt:101,family:"Sunflower Shoots"},{name:"Sunflower Shoots (L)",wt:250,family:"Sunflower Shoots"},
  {name:"Sunflower Shoots (RETAIL) (M)",wt:101,family:"Sunflower Shoots"},
  {name:"Pea Shoots (M)",wt:93,family:"Pea Shoots"},{name:"Pea Shoots (L)",wt:220,family:"Pea Shoots"},
  {name:"Pea Shoots (RETAIL) (M)",wt:93,family:"Pea Shoots"},{name:"Pea Shoots (SPUD Label) (M)",wt:93,family:"Pea Shoots"},
  {name:"Sky Hearts (S)",wt:15,family:"Sky Hearts"},{name:"Sky Hearts (M)",wt:35,family:"Sky Hearts"},
  {name:"Basil (S)",wt:17,family:"Basil"},{name:"Basil (M)",wt:33,family:"Basil"},
  {name:"Basil, Purple (S)",wt:17,family:"Basil"},{name:"Basil, Purple (M)",wt:33,family:"Basil"},
  {name:"Shiso, Green (S)",wt:16,family:"Shiso"},{name:"Shiso, Green (M)",wt:35,family:"Shiso"},
  {name:"Shiso, Purple (S)",wt:16,family:"Shiso"},{name:"Shiso, Purple (M)",wt:35,family:"Shiso"},
  {name:"Shiso, Britton (M)",wt:35,family:"Shiso"},
  {name:"Mustard (S)",wt:32,family:"Mustard"},{name:"Mustard (M)",wt:68,family:"Mustard"},
  {name:"Broccoli (S)",wt:42,family:"Broccoli"},
  {name:"Beets (S)",wt:32,family:"Beets"},{name:"Beets (M)",wt:58,family:"Beets"},
  {name:"Purple Cabbage (S)",wt:42,family:"Purple Cabbage"},{name:"Purple Cabbage (M)",wt:78,family:"Purple Cabbage"},
  {name:"Peppercress (M)",wt:78,family:"Peppercress"},
  {name:"Nasturtium (S)",wt:15,family:"Flowers"},{name:"Mint (S)",wt:11,family:"Mint"},
];

export function getProducts() { return PRODUCTS; }
export function findProduct(name) { return PRODUCTS.find(p=>p.name===name); }

// ── ROUTE LOGIC ────────────────────────────────────────────────────────────────
const ROUTES = {
  "North Shore":   ["Stongs North Van","Choices North Van","Parkgate Farm Market","Cioffi's"],
  "Downtown":      ["Kingyo Izakaya","Terminal City Club","Masayoshi","Boy With A Knife","Ama Raw Bar","Au & Petit Comptoir"],
  "Yaletown":      ["Choices Yaletown","Ancora Waterfront","Joe Fortes","Chambar"],
  "Richmond":      ["Hello Nori - Richmond","Plaza Premium","Exec Hotel Airport - Richmond","Marriott Vancouver Airport"],
  "Retail Run":    ["SPUD Vancouver","Greens Market","Artigiano Grand Cafe","Avela Catering"],
};

export function getRouteForCustomer(customerName) {
  for (const [route, customers] of Object.entries(ROUTES)) {
    if (customers.some(c => customerName.includes(c) || c.includes(customerName.split(" ")[0]))) return route;
  }
  return "Other";
}

export const TRANSPORT = {
  "North Shore": {mode:"🚗 Car",driver:"Sam Wright",depart:"7:00 AM"},
  "Downtown":    {mode:"🚲 Bike",driver:"Leo Park",depart:"9:00 AM"},
  "Yaletown":    {mode:"🚲 Bike",driver:"Leo Park",depart:"9:30 AM"},
  "Richmond":    {mode:"🚗 Car",driver:"Sam Wright",depart:"11:30 AM"},
  "Retail Run":  {mode:"🚐 Van",driver:"Maria Chen",depart:"8:00 AM"},
  "Other":       {mode:"🚗 Car",driver:"TBC",depart:"TBC"},
};

// ── STORE ──────────────────────────────────────────────────────────────────────
let state = {
  // One entry per confirmed order line: {id, customer, product, qty, wt, channel, source, confirmedAt, deliveryDate}
  confirmedLines: [],
  // Notification queue for toast messages
  notifications: [],
};

const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn({ ...state }));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return { ...state };
}

export function confirmOrderLines(lines, customer, channel, deliveryDate = "2026-05-28") {
  const newLines = lines
    .filter(l => l.qty > 0 && l.product !== "[Standing order]" && l.product !== "[Delivery date change]")
    .map(l => ({
      id: `wf-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      customer,
      product: l.product,
      qty: typeof l.qty === "number" ? l.qty : 0,
      wt: findProduct(l.product)?.wt || 0,
      channel,
      confirmedAt: new Date().toISOString(),
      deliveryDate,
    }));

  // Handle deltas (e.g. +3 means add to existing standing order qty)
  state = {
    ...state,
    confirmedLines: [...state.confirmedLines, ...newLines],
    notifications: [...state.notifications, {
      id: Date.now(),
      message: `${customer} — ${newLines.length} line${newLines.length !== 1 ? "s" : ""} added to Wed 28 May`,
      type: "success",
    }],
  };
  notify();
  // Auto-clear notification after 4s
  setTimeout(() => {
    state = { ...state, notifications: state.notifications.slice(1) };
    notify();
  }, 4000);
}

export function cancelOrder(customer) {
  state = {
    ...state,
    confirmedLines: state.confirmedLines.filter(l => l.customer !== customer),
    notifications: [...state.notifications, {
      id: Date.now(),
      message: `${customer} — order cancelled and removed`,
      type: "warning",
    }],
  };
  notify();
  setTimeout(() => {
    state = { ...state, notifications: state.notifications.slice(1) };
    notify();
  }, 4000);
}

// ── COMPUTED VIEWS ─────────────────────────────────────────────────────────────

// All confirmed lines grouped by product (for pick list)
export function getPickList() {
  const byProduct = {};
  for (const line of state.confirmedLines) {
    if (!byProduct[line.product]) {
      byProduct[line.product] = { product: line.product, wt: line.wt, totalQty: 0, customers: {} };
    }
    byProduct[line.product].totalQty += line.qty;
    byProduct[line.product].customers[line.customer] =
      (byProduct[line.product].customers[line.customer] || 0) + line.qty;
  }
  return Object.values(byProduct).sort((a, b) => {
    const fa = findProduct(a.product)?.family || "";
    const fb = findProduct(b.product)?.family || "";
    return fa.localeCompare(fb) || a.product.localeCompare(b.product);
  });
}

// Confirmed lines grouped by customer (for harvest grid view)
export function getOrdersByCustomer() {
  const byCustomer = {};
  for (const line of state.confirmedLines) {
    if (!byCustomer[line.customer]) byCustomer[line.customer] = {};
    byCustomer[line.customer][line.product] =
      (byCustomer[line.customer][line.product] || 0) + line.qty;
  }
  return byCustomer;
}

// Delivery runs: group by route, then by customer
export function getDeliveryRuns() {
  const byRoute = {};
  for (const line of state.confirmedLines) {
    const route = getRouteForCustomer(line.customer);
    if (!byRoute[route]) byRoute[route] = { route, transport: TRANSPORT[route], stops: {} };
    if (!byRoute[route].stops[line.customer]) byRoute[route].stops[line.customer] = [];
    byRoute[route].stops[line.customer].push(line);
  }
  return Object.values(byRoute).map(r => ({
    ...r,
    stopList: Object.entries(r.stops).map(([customer, lines]) => ({
      customer,
      items: lines.map(l => `${l.product} ×${l.qty}`).join(", "),
      totalPacks: lines.reduce((s, l) => s + l.qty, 0),
      valueCAD: lines.reduce((s, l) => s + l.qty * (l.wt / 1000) * 42, 0).toFixed(0),
    })),
    totalPacks: Object.values(r.stops).flat().reduce((s, l) => s + l.qty, 0),
  }));
}

// Unique customers with orders
export function getConfirmedCustomers() {
  return [...new Set(state.confirmedLines.map(l => l.customer))];
}
