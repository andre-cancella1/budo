export interface Students {
  id: string;          
  name: string;        
  address: string;     
  city: string;        
  state: string;      
  belt: string;        
  birth_date: string; 
  email: string;       
  cpf: string;        
  dojo_id: string;     
  created_at?: string; 
  updated_at?: string; 
}


export interface Belts {
  id: string; 
  color: string; 
  dojo_id: string;
}