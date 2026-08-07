import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatInventoryDifference, type InventoryCountFilterValue } from "@/lib/inventory-counts";

type InventoryCountPdfDocumentProps = {
  session: {
    id: number;
    warehouseName: string;
    createdAt: Date;
    createdByName: string;
    totalLines: number;
  };
  filters: {
    query: string;
    filter: InventoryCountFilterValue;
  };
  lines: Array<{
    productName: string;
    categoryName: string;
    variantLabel: string;
    sku: string | null;
    locationCode: string | null;
    expectedStock: number;
    countedStock: number | null;
    difference: number | null;
    note: string | null;
  }>;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, color: "#0f172a" },
  header: { marginBottom: 16 },
  eyebrow: { fontSize: 9, color: "#64748b", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#475569" },
  metaRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  metaCard: {
    flex: 1,
    border: "1 solid #e2e8f0",
    borderRadius: 10,
    padding: 10,
  },
  metaLabel: { fontSize: 8, color: "#64748b", marginBottom: 4, textTransform: "uppercase" },
  metaValue: { fontSize: 11, fontWeight: 700 },
  table: {
    border: "1 solid #e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottom: "1 solid #e2e8f0",
  },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #f1f5f9",
  },
  cell: { padding: 8, fontSize: 9 },
  productCell: { width: "24%" },
  variantCell: { width: "14%" },
  skuCell: { width: "14%" },
  locationCell: { width: "12%" },
  stockCell: { width: "9%", textAlign: "right" },
  countedCell: { width: "9%", textAlign: "right" },
  diffCell: { width: "9%", textAlign: "right" },
  noteCell: { width: "9%" },
  headerText: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: "#475569" },
  muted: { color: "#64748b" },
});

function getFilterLabel(filter: InventoryCountFilterValue) {
  switch (filter) {
    case "counted":
      return "Te numeruara";
    case "uncounted":
      return "Pa numeruar";
    case "changed":
      return "Me diference";
    default:
      return "Te gjitha";
  }
}

export function InventoryCountPdfDocument({
  session,
  filters,
  lines,
}: InventoryCountPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>StockBase • Inventory Count</Text>
          <Text style={styles.title}>Numerim #{session.id}</Text>
          <Text style={styles.subtitle}>
            {session.warehouseName} • {session.createdByName} •{" "}
            {new Date(session.createdAt).toLocaleString("sq-AL")}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Rreshta ne eksport</Text>
            <Text style={styles.metaValue}>{lines.length}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Rreshta totale</Text>
            <Text style={styles.metaValue}>{session.totalLines}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Filter</Text>
            <Text style={styles.metaValue}>{getFilterLabel(filters.filter)}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Kerkim</Text>
            <Text style={styles.metaValue}>{filters.query || "-"}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, styles.productCell, styles.headerText]}>Produkti</Text>
            <Text style={[styles.cell, styles.variantCell, styles.headerText]}>Varianti</Text>
            <Text style={[styles.cell, styles.skuCell, styles.headerText]}>SKU</Text>
            <Text style={[styles.cell, styles.locationCell, styles.headerText]}>Lokacioni</Text>
            <Text style={[styles.cell, styles.stockCell, styles.headerText]}>Sistem</Text>
            <Text style={[styles.cell, styles.countedCell, styles.headerText]}>Real</Text>
            <Text style={[styles.cell, styles.diffCell, styles.headerText]}>Dif.</Text>
            <Text style={[styles.cell, styles.noteCell, styles.headerText]}>Shenim</Text>
          </View>

          {lines.map((line, index) => (
            <View key={`${line.sku ?? line.productName}-${index}`} style={styles.row}>
              <View style={[styles.cell, styles.productCell]}>
                <Text>{line.productName}</Text>
                <Text style={styles.muted}>{line.categoryName}</Text>
              </View>
              <Text style={[styles.cell, styles.variantCell]}>{line.variantLabel}</Text>
              <Text style={[styles.cell, styles.skuCell]}>{line.sku ?? "-"}</Text>
              <Text style={[styles.cell, styles.locationCell]}>{line.locationCode ?? "-"}</Text>
              <Text style={[styles.cell, styles.stockCell]}>{line.expectedStock}</Text>
              <Text style={[styles.cell, styles.countedCell]}>
                {line.countedStock === null ? "-" : line.countedStock}
              </Text>
              <Text style={[styles.cell, styles.diffCell]}>
                {formatInventoryDifference(line.difference)}
              </Text>
              <Text style={[styles.cell, styles.noteCell]}>{line.note ?? "-"}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
