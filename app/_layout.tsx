import { Ionicons } from '@expo/vector-icons';
import { Slot, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function MainLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [isMobile, setIsMobile] = useState(Dimensions.get('window').width < 768);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setIsMobile(window.width < 768);
    });
    return () => subscription?.remove();
  }, []);

  if (pathname === '/login' || pathname === '/') return <Slot />;

  const navigateTo = (route: string) => {
    router.push(route);
    setIsMenuOpen(false);
  };

  const MenuContent = () => (
    <View style={styles.sidebarInner}>
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Image 
            source={require('../assets/images/kimono.png')} 
            style={styles.logoImg} 
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity
          style={[styles.menuItem, pathname === '/home' && styles.menuItemActive]}
          onPress={() => navigateTo('/home')}
        >
          <Ionicons name="people" size={24} color="#fff" />
          <Text style={styles.menuText}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, pathname === '/finance' && styles.menuItemActive]}
          onPress={() => navigateTo('/finance')}
        >
          <Ionicons name="cash-outline" size={24} color="#fff" />
          <Text style={styles.menuText}>Financeiro</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => navigateTo('/')}>
        <Ionicons name="log-out-outline" size={22} color="#fff" />
        <Text style={styles.menuText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {!isMobile && (
        <View style={styles.sidebarDesktop}>
          <MenuContent />
        </View>
      )}

      {/* MENU GAVETA MOBILE: Ajustado para aparecer na esquerda */}
      {isMobile && (
        <Modal 
          visible={isMenuOpen} 
          animationType="fade" // Fade fica melhor para simulador de drawer lateral
          transparent={true}
          onRequestClose={() => setIsMenuOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.drawerContainer}>
              <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.drawerHeader}>
                  <TouchableOpacity onPress={() => setIsMenuOpen(false)}>
                    <Ionicons name="close" size={32} color="#fff" />
                  </TouchableOpacity>
                </View>
                <MenuContent />
              </SafeAreaView>
            </View>
            {/* Área de fechar ao clicar fora (lado direito) */}
            <TouchableOpacity 
              style={styles.modalCloseArea} 
              activeOpacity={1} 
              onPress={() => setIsMenuOpen(false)} 
            />
          </View>
        </Modal>
      )}

      <View style={styles.content}>
        {isMobile && (
          <View style={styles.mobileTopBar}>
            <TouchableOpacity onPress={() => setIsMenuOpen(true)}>
              <Ionicons name="menu" size={32} color="#1B2559" />
            </TouchableOpacity>
            <Text style={styles.mobileLogoText}>BUDO</Text>
          </View>
        )}
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F4F7FE',
  },
  sidebarDesktop: {
    width: 260,
    backgroundColor: '#1A1C23',
    height: '100%',
  },
  sidebarInner: {
    flex: 1,
    paddingHorizontal: 15,
  },
  // AJUSTE: O drawer ocupa apenas parte da tela na esquerda
  drawerContainer: {
    width: 280,
    backgroundColor: '#1A1C23',
    height: '100%',
    // Sombra para destacar o menu do fundo
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.5, shadowRadius: 5 },
      android: { elevation: 10 },
    }),
  },
  content: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  logoCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: '#B31D1D',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoImg: {
    width: 60,
    height: 60,
  },
  menu: {
    flex: 1,
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 15,
  },
  menuItemActive: {
    backgroundColor: '#B31D1D',
  },
  menuText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 15,
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  mobileTopBar: {
    height: 65,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E5F2',
    gap: 15,
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
  },
  mobileLogoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1B2559',
  },
  // AJUSTE: O overlay agora é um flex-row para o menu ficar na esquerda
  modalOverlay: {
    flex: 1,
    flexDirection: 'row', // Alinha Drawer e CloseArea lado a lado
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCloseArea: {
    flex: 1, // Ocupa o restante da tela à direita
  },
  drawerHeader: {
    padding: 20,
    alignItems: 'flex-end',
  },
});