import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

type PurchaseOrderPdfDocumentProps = {
  order: {
    id: number;
    supplierName: string;
    warehouseName: string;
    orderedAtLabel: string;
    statusLabel: string;
    totalLabel: string;
    totalQuantity: number;
    itemCount: number;
    note: string | null;
  };
  items: Array<{
    productName: string;
    variantLabel: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
    unitCostLabel: string;
    lineTotalLabel: string;
  }>;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, color: "#0f172a" },
  eyebrow: { fontSize: 9, color: "#64748b", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#475569", marginBottom: 14 },
  metaRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  metaCard: { flex: 1, border: "1 solid #e2e8f0", borderRadius: 10, padding: 10 },
  metaLabel: { fontSize: 8, color: "#64748b", marginBottom: 4, textTransform: "uppercase" },
  metaValue: { fontSize: 11, fontWeight: 700 },
  table: { border: "1 solid #e2e8f0", borderRadius: 10, overflow: "hidden" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottom: "1 solid #e2e8f0",
  },
  row: { flexDirection: "row", borderBottom: "1 solid #f1f5f9" },
  cell: { padding: 8, fontSize: 9 },
  productCell: { width: "28%" },
  variantCell: { width: "16%" },
  quantityCell: { width: "10%", textAlign: "right" },
  receivedCell: { width: "10%", textAlign: "right" },
  remainingCell: { width: "10%", textAlign: "right" },
  costCell: { width: "12%", textAlign: "right" },
  totalCell: { width: "14%", textAlign: "right" },
  headerText: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: "#475569" },
  noteBox: {
    marginTop: 14,
    border: "1 solid #e2e8f0",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f8fafc",
  },
  noteTitle: { fontSize: 8, color: "#64748b", textTransform: "uppercase", marginBottom: 4 },
});

export function PurchaseOrderPdfDocument({ order, items }: PurchaseOrderPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <Text style={styles.eyebrow}>StockBase • Purchase Order</Text>
        <Text style={styles.title}>PO #{order.id}</Text>
        <Text style={styles.subtitle}>
          {order.supplierName} • {order.warehouseName} • {order.orderedAtLabel}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Statusi</Text>
            <Text style={styles.metaValue}>{order.statusLabel}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Rreshta</Text>
            <Text style={styles.metaValue}>{order.itemCount}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Sasia totale</Text>
            <Text style={styles.metaValue}>{order.totalQuantity}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Vlera totale</Text>
            <Text style={styles.metaValue}>{order.totalLabel}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, styles.productCell, styles.headerText]}>Produkti</Text>
            <Text style={[styles.cell, styles.variantCell, styles.headerText]}>Varianti</Text>
            <Text style={[styles.cell, styles.quantityCell, styles.headerText]}>Order</Text>
            <Text style={[styles.cell, styles.receivedCell, styles.headerText]}>Pranuar</Text>
            <Text style={[styles.cell, styles.remainingCell, styles.headerText]}>Mbetur</Text>
            <Text style={[styles.cell, styles.costCell, styles.headerText]}>Cmimi</Text>
            <Text style={[styles.cell, styles.totalCell, styles.headerText]}>Totali</Text>
          </View>

          {items.map((item, index) => (
            <View key={`${item.productName}-${item.variantLabel}-${index}`} style={styles.row}>
              <Text style={[styles.cell, styles.productCell]}>{item.productName}</Text>
              <Text style={[styles.cell, styles.variantCell]}>{item.variantLabel}</Text>
              <Text style={[styles.cell, styles.quantityCell]}>{item.orderedQuantity}</Text>
              <Text style={[styles.cell, styles.receivedCell]}>{item.receivedQuantity}</Text>
              <Text style={[styles.cell, styles.remainingCell]}>{item.remainingQuantity}</Text>
              <Text style={[styles.cell, styles.costCell]}>{item.unitCostLabel}</Text>
              <Text style={[styles.cell, styles.totalCell]}>{item.lineTotalLabel}</Text>
            </View>
          ))}
        </View>

        {order.note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>Shenim</Text>
            <Text>{order.note}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
