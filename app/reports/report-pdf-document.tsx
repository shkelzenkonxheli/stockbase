import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { MonthlySalesReport } from "@/lib/reports/monthly-sales-report";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    color: "#0f172a",
  },
  header: {
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#475569",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: "48%",
    border: "1 solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
  },
  statLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
  },
  statMeta: {
    fontSize: 10,
    color: "#475569",
  },
  section: {
    marginBottom: 18,
    border: "1 solid #e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
  },
  sourceGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  sourceCard: {
    flex: 1,
    border: "1 solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
  },
  sectionHeader: {
    borderBottom: "1 solid #e2e8f0",
    padding: 12,
    fontSize: 14,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #f1f5f9",
  },
  cell: {
    padding: 10,
    flexGrow: 1,
  },
  cellRight: {
    padding: 10,
    width: 80,
    textAlign: "right",
    fontWeight: 700,
  },
  smallGrid: {
    flexDirection: "row",
    gap: 12,
  },
  smallSection: {
    flex: 1,
    border: "1 solid #e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
  },
  muted: {
    color: "#64748b",
  },
  empty: {
    padding: 12,
    color: "#64748b",
  },
});

export function ReportPdfDocument({ report }: { report: MonthlySalesReport }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ShkelShoes • Raport mujor</Text>
          <Text style={styles.title}>Shitjet per {report.monthLabel}</Text>
          <Text style={styles.subtitle}>
            Gjeneruar nga sistemi i menaxhimit te stokut
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Porosi</Text>
            <Text style={styles.statValue}>{report.ordersCount}</Text>
            <Text style={styles.statMeta}>Gjithe porosite e muajit</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Copa</Text>
            <Text style={styles.statValue}>{report.totalPairs}</Text>
            <Text style={styles.statMeta}>Patika te shitura ne total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Modele aktive</Text>
            <Text style={styles.statValue}>{report.topModels.length}</Text>
            <Text style={styles.statMeta}>Modele me shitje ne kete muaj</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Burimi kryesor</Text>
            <Text style={styles.statValue}>{report.topSourceLabel ?? "-"}</Text>
            <Text style={styles.statMeta}>
              {report.topSourceLabel
                ? `${report.topSourceQuantity} cope`
                : "Nuk ka shitje"}
            </Text>
          </View>
        </View>

        <View style={styles.sourceGrid}>
          {report.sourceBreakdown.map((item) => (
            <View key={item.source} style={styles.sourceCard}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statValue}>{item.quantity}</Text>
              <Text style={styles.statMeta}>Copa te shitura</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Top modelet</Text>
          {report.topModels.length === 0 ? (
            <Text style={styles.empty}>Nuk ka shitje per kete muaj.</Text>
          ) : (
            <>
              {report.topModels.map((item) => (
                <View key={`${item.brand}-${item.name}`} style={styles.row}>
                  <Text style={[styles.cell, styles.muted]}>{item.brand}</Text>
                  <Text style={styles.cell}>{item.name}</Text>
                  <Text style={styles.cellRight}>{item.quantity}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.smallGrid}>
          <View style={styles.smallSection}>
            <Text style={styles.sectionHeader}>Sipas kategorise</Text>
            {report.topBrands.length === 0 ? (
              <Text style={styles.empty}>Nuk ka te dhena.</Text>
            ) : (
              <>
                {report.topBrands.map((item) => (
                  <View key={item.brand} style={styles.row}>
                    <Text style={styles.cell}>{item.brand}</Text>
                    <Text style={styles.cellRight}>{item.quantity}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          <View style={styles.smallSection}>
            <Text style={styles.sectionHeader}>Ritmi ditor</Text>
            {report.dailySales.length === 0 ? (
              <Text style={styles.empty}>Nuk ka te dhena.</Text>
            ) : (
              <>
                {report.dailySales.map((item) => (
                  <View key={item.date} style={styles.row}>
                    <Text style={styles.cell}>{item.date}</Text>
                    <Text style={styles.cellRight}>{item.quantity}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}
