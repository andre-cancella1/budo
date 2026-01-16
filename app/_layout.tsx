import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* CONFIGURAÇÃO ESPECÍFICA DA HOME: Remove o header apenas aqui */}
        <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Acessar Conta', // Título que aparece no navegador
          headerShown: false      // Se quiser esconder a barra de cima no Login
        }} 
      />
      <Stack.Screen 
        name="home" 
        options={{ 
          title: 'Minha Home', 
          headerShown: true 
        }} 
      />

        {/* O RESTO CONTINUA COM O PADRÃO: (tabs) e modal */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      
      {/* "auto" ou "light" dependendo da sua preferência visual */}
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

