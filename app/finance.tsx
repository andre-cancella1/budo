import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
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

const currentYearStr = new Date().getFullYear().toString();
const ANOS = [
  currentYearStr,
  (parseInt(currentYearStr) + 1).toString(),
  (parseInt(currentYearStr) + 2).toString()
];

// Função auxiliar para pegar a data de hoje correta no fuso horário local (AAAA-MM-DD)
const getHojeISO = () => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

// Transforma AAAA-MM-DD em DD/MM/AAAA
const formatarDataBR = (dataString: string) => {
  if (!dataString) return '';
  const partes = dataString.split('-');
  if (partes.length !== 3) return dataString;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

// Transforma DD/MM/AAAA em AAAA-MM-DD (para salvar no banco caso digitem com barra)
const formatarDataISO = (dataString: string) => {
  if (!dataString) return '';
  if (dataString.includes('/')) {
    const partes = dataString.split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
  }
  return dataString;
};

export default function FinanceiroScreen() {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isMobile = screenWidth < 768;
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [resumo, setResumo] = useState({ recebido: 0, pendente: 0 });
  const [dojoId, setDojoId] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(currentYearStr);

  // ESTADOS DO MODAL DE NOVO PAGAMENTO
  const [modalVisible, setModalVisible] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Campos do formulário (Armazena como string legível ou ISO padrão)
  const [alunoInput, setAlunoInput] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState<{ id: string; name: string } | null>(null);
  const [sugestoesAlunos, setSugestoesAlunos] = useState<any[]>([]);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [statusNovo, setStatusNovo] = useState<'PAGO' | 'PENDENTE'>('PENDENTE');
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  // Estado modificado: guarda o formato correto para exibição de acordo com a plataforma
  const [dataVencimento, setDataVencimento] = useState(
    Platform.OS === 'web' ? getHojeISO() : formatarDataBR(getHojeISO())
  );

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    fetchFinanceiro();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (alunoInput.length > 1 && !alunoSelecionado) {
      buscarSugestoesAlunos(alunoInput);
    } else if (alunoInput.length === 0) {
      setSugestoesAlunos([]);
      setAlunoSelecionado(null);
    }
  }, [alunoInput]);

  async function fetchFinanceiro() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: dojo } = await supabase.from('dojo_users').select('dojo_id').eq('user_id', user.id).maybeSingle();

      if (dojo) {
        setDojoId(dojo.dojo_id);
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

  async function buscarSugestoesAlunos(texto: string) {
    if (!dojoId) return;
    const { data } = await supabase
      .from('students')
      .select('id, name')
      .eq('dojo_id', dojoId)
      .ilike('name', `%${texto}%`)
      .limit(5);

    if (data) setSugestoesAlunos(data);
  }

  async function handleCriarPagamento() {
    if (!alunoSelecionado || !valor || !descricao || !dataVencimento) {
      Alert.alert('Aviso', 'Preencha todos os campos obrigatórios.');
      return;
    }

    // Garante que vai salvar como AAAA-MM-DD no Supabase independente de como foi digitado
    const dataFormatadaParaBanco = formatarDataISO(dataVencimento);

    try {
      setSalvando(true);
      const { error } = await supabase.from('payments').insert([{
        dojo_id: dojoId,
        student_id: alunoSelecionado.id,
        description: descricao,
        amount: parseFloat(valor.replace(',', '.')),
        status: statusNovo,
        due_date: dataFormatadaParaBanco
      }]);

      if (error) throw error;

      setModalVisible(false);
      setAlunoInput('');
      setAlunoSelecionado(null);
      setDescricao('');
      setValor('');
      setStatusNovo('PENDENTE');
      setDataVencimento(Platform.OS === 'web' ? getHojeISO() : formatarDataBR(getHojeISO()));

      fetchFinanceiro();
    } catch (e: any) {
      Alert.alert('Erro ao salvar', e.message);
    } finally {
      setSalvando(false);
    }
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

          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity style={styles.btnCreatePayment} onPress={() => setModalVisible(true)}>
              <Ionicons name="add-circle-outline" size={18} color="#FFF" />
              <Text style={styles.btnCreateText}>Lançar Pagamento</Text>
            </TouchableOpacity>

            <View style={styles.filterBarContainer}>
              <View style={styles.monthSegment}>
                <Ionicons name="calendar-outline" size={18} color="#b31d1d" />
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
            <ActivityIndicator size="large" color="#b31d1d" />
          ) : (
            <FlatList
              data={pagamentos.filter(p => p.students?.name.toLowerCase().includes(searchText.toLowerCase()))}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={isMobile ? styles.mobileCard : styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.studentName}>{item.students?.name}</Text>
                    <Text style={styles.mobileSubText}>
                      {item.description} {isMobile && `• ${formatarDataBR(item.due_date)}`}
                    </Text>
                  </View>
                  {!isMobile && <Text style={[styles.cell, { flex: 1 }]}>{formatarDataBR(item.due_date)}</Text>}
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
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#A3AED0', marginTop: 20 }}>Nenhum registro encontrado.</Text>}
            />
          )}
        </View>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lançar Novo Pagamento</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#A3AED0" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }} keyboardShouldPersistTaps="handled">

              <Text style={styles.formLabel}>Aluno *</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="person-outline" size={18} color="#A3AED0" style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Comece a digitar o nome..."
                  value={alunoInput}
                  onChangeText={(txt) => {
                    setAlunoInput(txt);
                    if (alunoSelecionado) setAlunoSelecionado(null);
                  }}
                />
                {alunoSelecionado && <Ionicons name="checkmark-circle" size={20} color="#05CD99" style={{ marginRight: 12 }} />}
              </View>

              {sugestoesAlunos.length > 0 && !alunoSelecionado && (
                <View style={styles.suggestionsBox}>
                  {sugestoesAlunos.map((aluno) => (
                    <TouchableOpacity
                      key={aluno.id}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setAlunoSelecionado(aluno);
                        setAlunoInput(aluno.name);
                        setSugestoesAlunos([]);
                      }}
                    >
                      <Text style={styles.suggestionText}>{aluno.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.formLabel}>Descrição *</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="document-text-outline" size={18} color="#A3AED0" style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ex: Mensalidade Julho, Exame de Faixa..."
                  value={descricao}
                  onChangeText={setDescricao}
                />
              </View>

              <Text style={styles.formLabel}>Valor (R$) *</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="cash-outline" size={18} color="#A3AED0" style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="0,00"
                  keyboardType="numeric"
                  value={valor}
                  onChangeText={setValor}
                />
              </View>

              <Text style={styles.formLabel}>Data de Vencimento *</Text>

              <View style={styles.inputWithIcon}>
                <Ionicons
                  name="calendar-number-outline"
                  size={18}
                  color="#A3AED0"
                  style={{ marginLeft: 12 }}
                />

                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 14,
                      paddingLeft: 10,
                      height: '100%',
                    }}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        height: '100%',
                      }}
                      onPress={() => setMostrarCalendario(true)}
                    >
                      <Text
                        style={{
                          paddingHorizontal: 10,
                          color: '#2B3674',
                          fontSize: 14,
                        }}
                      >
                        {formatarDataBR(dataVencimento)}
                      </Text>
                    </TouchableOpacity>

                    {mostrarCalendario && (
                      <DateTimePicker
                        value={new Date(dataVencimento)}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setMostrarCalendario(false);

                          if (selectedDate) {
                            const ano = selectedDate.getFullYear();
                            const mes = String(selectedDate.getMonth() + 1).padStart(2, '0');
                            const dia = String(selectedDate.getDate()).padStart(2, '0');

                            setDataVencimento(`${ano}-${mes}-${dia}`);
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </View>

              <Text style={styles.formLabel}>Situação Inicial</Text>
              <View style={styles.statusToggleGroup}>
                <TouchableOpacity
                  style={[styles.statusSelectorBtn, statusNovo === 'PENDENTE' && styles.statusBtnPendenteActive]}
                  onPress={() => setStatusNovo('PENDENTE')}
                >
                  <Text style={[styles.statusBtnText, statusNovo === 'PENDENTE' && { color: '#EE5D50' }]}>🔴 PENDENTE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusSelectorBtn, statusNovo === 'PAGO' && styles.statusBtnPagoActive]}
                  onPress={() => setStatusNovo('PAGO')}
                >
                  <Text style={[styles.statusBtnText, statusNovo === 'PAGO' && { color: '#05CD99' }]}>🟢 PAGO</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnSave, salvando && { opacity: 0.6 }]}
                  onPress={handleCriarPagamento}
                  disabled={salvando}
                >
                  {salvando ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.btnSaveText}>Salvar Lançamento</Text>}
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FE' },
  mainContent: { flex: 1, padding: 25 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, flexWrap: 'wrap', gap: 15 },
  headerTitleWeb: { fontSize: 24, fontWeight: 'bold', color: '#1B2559' },

  btnCreatePayment: { backgroundColor: '#b31d1d', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 46, borderRadius: 30, shadowColor: '#b31d1d', shadowOpacity: 0.15, shadowRadius: 8, elevation: 2 },
  btnCreateText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  filterBarContainer: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 30, borderWidth: 1, borderColor: '#E0E5F2', alignItems: 'center', paddingHorizontal: 15, height: 46, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10 },
  monthSegment: { flexDirection: 'row', alignItems: 'center', paddingRight: 10, minWidth: 100, position: 'relative' },
  yearSegment: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, width: 80, justifyContent: 'center', position: 'relative' },
  pickerLabelText: { fontSize: 13, fontWeight: '600', color: '#2B3674', marginHorizontal: 6 },
  invisiblePicker: { position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' },
  verticalDivider: { width: 1, height: 18, backgroundColor: '#E0E5F2' },

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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(18, 24, 63, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 480, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B2559' },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#2B3674', marginTop: 14, marginBottom: 8 },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F7FE', borderRadius: 12, borderWidth: 1, borderColor: '#E0E5F2', height: 46 },
  modalInput: { flex: 1, paddingHorizontal: 10, fontSize: 14, color: '#2B3674', height: '100%' },

  suggestionsBox: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E5F2', marginTop: 4, maxHeight: 150, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F4F7FE' },
  suggestionText: { fontSize: 14, color: '#2B3674' },

  statusToggleGroup: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statusSelectorBtn: { flex: 1, backgroundColor: '#F4F7FE', height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#E0E5F2', alignItems: 'center', justifyContent: 'center' },
  statusBtnPendenteActive: { borderColor: '#EE5D50', backgroundColor: '#FFF5F5' },
  statusBtnPagoActive: { borderColor: '#05CD99', backgroundColor: '#E6FFF5' },
  statusBtnText: { fontSize: 13, fontWeight: 'bold', color: '#A3AED0' },

  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 24, justifyContent: 'flex-end' },
  btnCancel: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  btnCancelText: { color: '#A3AED0', fontWeight: '600', fontSize: 14 },

  btnSave: { backgroundColor: '#b31d1d', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#b31d1d', shadowOpacity: 0.15, shadowRadius: 5 },
  btnSaveText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});