import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Head from 'expo-router/head';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../lib/supabase';

const MESES = [
  { label: 'Anual', value: 'all' },
  { label: 'Janeiro', value: '0' }, { label: 'Fevereiro', value: '1' },
  { label: 'Março', value: '2' }, { label: 'Abril', value: '3' },
  { label: 'Maio', value: '4' }, { label: 'Junho', value: '5' },
  { label: 'Julho', value: '6' }, { label: 'Agosto', value: '7' },
  { label: 'Setembro', value: '8' }, { label: 'Outubro', value: '9' },
  { label: 'Novembro', value: '10' }, { label: 'Dezembro', value: '11' },
];

// LÓGICA ATUALIZADA: Ano Atual + Próximos 2 anos
const currentYearStr = new Date().getFullYear().toString();
const ANOS = [
  currentYearStr, 
  (parseInt(currentYearStr) + 1).toString(), 
  (parseInt(currentYearStr) + 2).toString()
];

export default function FinanceiroScreen() {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isMobile = screenWidth < 768;
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [resumo, setResumo] = useState({ recebido: 0, pendente: 0 });

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(currentYearStr);

  useEffect(() => {
    fetchFinanceiro();
  }, [selectedMonth, selectedYear]);

  async function fetchFinanceiro() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: dojo } = await supabase.from('dojo_users').select('dojo_id').eq('user_id', user.id).maybeSingle();
      
      if (dojo) {
        let query = supabase.from('payments').select(`id, amount, due_date, status, description, students ( name )`).eq('dojo_id', dojo.dojo_id);
        
        if (selectedMonth === 'all') {
          query = query.gte('due_date', `${selectedYear}-01-01`).lte('due_date', `${selectedYear}-12-31`);
        } else {
          const firstDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1).toISOString().split('T')[0];
          const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0).toISOString().split('T')[0];
          query = query.gte('due_date', firstDay).lte('due_date', lastDay);
        }
        
        const { data } = await query.order('due_date', { ascending: true });
        if (data) {
          setPagamentos(data);
          setResumo({
            recebido: data.filter(p => p.status === 'PAGO').reduce((acc, curr) => acc + curr.amount, 0),
            pendente: data.filter(p => p.status === 'PENDENTE').reduce((acc, curr) => acc + curr.amount, 0)
          });
        }
      }
    } catch (e: any) { Alert.alert('Erro', e.message); } finally { setLoading(false); }
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'PAGO' ? 'PENDENTE' : 'PAGO';
    await supabase.from('payments').update({ status: newStatus }).eq('id', id);
    fetchFinanceiro();
  };

  return (
    <View style={styles.container}>
      <Head><title>Financeiro | Budo</title></Head>

      <View style={styles.mainContent}>
        
        <View style={styles.headerRow}>
          <Text style={styles.headerTitleWeb}>Fluxo de Caixa</Text>
          
          <View style={styles.filterBarContainer}>
            {/* SEGMENTO MÊS */}
            <View style={styles.monthSegment}>
              <Ionicons name="calendar-outline" size={18} color="#4318FF" />
              <Text style={styles.pickerLabelText}>
                {MESES.find(m => m.value === selectedMonth)?.label}
              </Text>
              <Picker
                selectedValue={selectedMonth}
                onValueChange={(v) => setSelectedMonth(v)}
                style={styles.invisiblePicker}
              >
                {MESES.map(m => <Picker.Item key={m.value} label={m.label} value={m.value} />)}
              </Picker>
              <Ionicons name="chevron-down" size={12} color="#A3AED0" />
            </View>
            
            <View style={styles.verticalDivider} />

            {/* SEGMENTO ANO (REDUZIDO) */}
            <View style={styles.yearSegment}>
              <Text style={styles.pickerLabelText}>{selectedYear}</Text>
              <Picker
                selectedValue={selectedYear}
                onValueChange={(v) => setSelectedYear(v)}
                style={styles.invisiblePicker}
              >
                {ANOS.map(a => <Picker.Item key={a} label={a} value={a} />)}
              </Picker>
              <Ionicons name="chevron-down" size={12} color="#A3AED0" />
            </View>
          </View>
        </View>

        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { borderTopColor: '#05CD99' }]}>
            <Text style={styles.summaryLabel}>Total Recebido</Text>
            <Text style={[styles.summaryValue, { color: '#05CD99' }]}>R$ {resumo.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: '#EE5D50' }]}>
            <Text style={styles.summaryLabel}>Pendente</Text>
            <Text style={[styles.summaryValue, { color: '#EE5D50' }]}>R$ {resumo.pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#A3AED0" style={{ marginLeft: 15 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar aluno..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <View style={styles.webCard}>
          {loading ? (
            <ActivityIndicator size="large" color="#4318FF" />
          ) : (
            <FlatList
              data={pagamentos.filter(p => p.students?.name.toLowerCase().includes(searchText.toLowerCase()))}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={isMobile ? styles.mobileCard : styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.studentName}>{item.students?.name}</Text>
                    <Text style={styles.mobileSubText}>{item.description}</Text>
                  </View>
                  {!isMobile && <Text style={[styles.cell, { flex: 1 }]}>{item.due_date.split('-').reverse().join('/')}</Text>}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cell, { fontWeight: '700' }]}>R$ {item.amount.toFixed(2)}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: isMobile ? 'flex-end' : 'center' }}>
                    <TouchableOpacity 
                      style={[styles.statusBadge, item.status === 'PAGO' ? styles.statusPago : styles.statusPendente]}
                      onPress={() => handleToggleStatus(item.id, item.status)}
                    >
                      <Text style={[styles.statusText, item.status === 'PAGO' ? styles.textPago : styles.textPendente]}>{item.status}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={{textAlign: 'center', color: '#A3AED0', marginTop: 20}}>Nenhum registro encontrado.</Text>}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FE' },
  mainContent: { flex: 1, padding: 25 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, flexWrap: 'wrap', gap: 15 },
  headerTitleWeb: { fontSize: 24, fontWeight: 'bold', color: '#1B2559' },

  filterBarContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#FFF', 
    borderRadius: 30, 
    borderWidth: 1, 
    borderColor: '#E0E5F2', 
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 46,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  monthSegment: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingRight: 10,
    minWidth: 100,
    position: 'relative'
  },
  yearSegment: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingLeft: 10,
    width: 80,
    justifyContent: 'center',
    position: 'relative'
  },
  pickerLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2B3674',
    marginHorizontal: 6,
  },
  invisiblePicker: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
    cursor: 'pointer',
  },
  verticalDivider: { 
    width: 1, 
    height: 18, 
    backgroundColor: '#E0E5F2'
  },

  summaryContainer: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  summaryCard: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 20, elevation: 2, borderTopWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  summaryLabel: { color: '#A3AED0', fontSize: 12, fontWeight: 'bold' },
  summaryValue: { fontSize: 22, fontWeight: 'bold', marginTop: 5 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 15, marginBottom: 25, elevation: 1, height: 50, borderWidth: 1, borderColor: '#E0E5F2' },
  searchInput: { flex: 1, padding: 12, color: '#2B3674' },
  webCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 2, flex: 1 },
  tableRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#F4F7FE', alignItems: 'center' },
  cell: { color: '#2B3674', fontSize: 15 },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#2B3674' },
  mobileCard: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#F4F7FE', alignItems: 'center', justifyContent: 'space-between' },
  mobileSubText: { color: '#A3AED0', fontSize: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 90, alignItems: 'center' },
  statusPago: { backgroundColor: '#E6FFF5' },
  statusPendente: { backgroundColor: '#FFF5F5' },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  textPago: { color: '#05CD99' },
  textPendente: { color: '#EE5D50' },
});