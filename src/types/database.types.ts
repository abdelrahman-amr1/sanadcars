export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          subscription_plan: 'free' | 'premium' | 'enterprise';
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          subscription_plan?: 'free' | 'premium' | 'enterprise';
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          subscription_plan?: 'free' | 'premium' | 'enterprise';
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tenant_members: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'operator';
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role?: 'owner' | 'admin' | 'operator';
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          role?: 'owner' | 'admin' | 'operator';
          created_at?: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          tenant_id: string;
          plate_number: string;
          model: string;
          owner_national_id: string;
          owner_name: string;
          external_supplier: string | null;
          current_mileage: number;
          status: 'available' | 'in_operation' | 'maintenance';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          plate_number: string;
          model: string;
          owner_national_id: string;
          owner_name: string;
          external_supplier?: string | null;
          current_mileage: number;
          status?: 'available' | 'in_operation' | 'maintenance';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          plate_number?: string;
          model?: string;
          owner_national_id?: string;
          owner_name?: string;
          external_supplier?: string | null;
          current_mileage?: number;
          status?: 'available' | 'in_operation' | 'maintenance';
          created_at?: string;
          updated_at?: string;
        };
      };
      drivers: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          license_number: string;
          license_expiry: string;
          phone: string;
          status: 'active' | 'inactive' | 'in_operation';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          license_number: string;
          license_expiry: string;
          phone: string;
          status?: 'active' | 'inactive' | 'in_operation';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          license_number?: string;
          license_expiry?: string;
          phone?: string;
          status?: 'active' | 'inactive' | 'in_operation';
          created_at?: string;
          updated_at?: string;
        };
      };
      operation_orders: {
        Row: {
          id: string;
          tenant_id: string;
          vehicle_id: string;
          driver_id: string;
          customer_name: string;
          customer_phone: string;
          expected_out_date: string;
          expected_return_date: string;
          actual_out_date: string | null;
          actual_return_date: string | null;
          out_mileage: number;
          return_mileage: number | null;
          status: 'draft' | 'active' | 'pending_settlement' | 'closed';
          amount_received_from_customer: number;
          amount_paid_to_external_supplier: number;
          net_profit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          vehicle_id: string;
          driver_id: string;
          customer_name: string;
          customer_phone: string;
          expected_out_date: string;
          expected_return_date: string;
          actual_out_date?: string | null;
          actual_return_date?: string | null;
          out_mileage: number;
          return_mileage?: number | null;
          status?: 'draft' | 'active' | 'pending_settlement' | 'closed';
          amount_received_from_customer?: number;
          amount_paid_to_external_supplier?: number;
          net_profit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          vehicle_id?: string;
          driver_id?: string;
          customer_name?: string;
          customer_phone?: string;
          expected_out_date?: string;
          expected_return_date?: string;
          actual_out_date?: string | null;
          actual_return_date?: string | null;
          out_mileage?: number;
          return_mileage?: number | null;
          status?: 'draft' | 'active' | 'pending_settlement' | 'closed';
          amount_received_from_customer?: number;
          amount_paid_to_external_supplier?: number;
          net_profit?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          tenant_id: string;
          order_id: string | null;
          amount: number;
          category: 'fuel' | 'toll' | 'parking' | 'cleaning' | 'other';
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          order_id?: string | null;
          amount: number;
          category: 'fuel' | 'toll' | 'parking' | 'cleaning' | 'other';
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          order_id?: string | null;
          amount?: number;
          category?: 'fuel' | 'toll' | 'parking' | 'cleaning' | 'other';
          description?: string | null;
          created_at?: string;
        };
      };
      traffic_violations: {
        Row: {
          id: string;
          tenant_id: string;
          violation_number: string;
          amount: number;
          violation_date: string;
          vehicle_id: string;
          order_id: string | null;
          status: 'pending' | 'paid';
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          violation_number: string;
          amount: number;
          violation_date: string;
          vehicle_id: string;
          order_id?: string | null;
          status?: 'pending' | 'paid';
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          violation_number?: string;
          amount?: number;
          violation_date?: string;
          vehicle_id?: string;
          order_id?: string | null;
          status?: 'pending' | 'paid';
          created_at?: string;
        };
      };
      maintenance_logs: {
        Row: {
          id: string;
          tenant_id: string;
          vehicle_id: string;
          mileage_at_maintenance: number;
          description: string;
          cost: number;
          maintenance_date: string;
          next_maintenance_mileage: number;
          is_completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          vehicle_id: string;
          mileage_at_maintenance: number;
          description: string;
          cost?: number;
          maintenance_date: string;
          next_maintenance_mileage: number;
          is_completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          vehicle_id?: string;
          mileage_at_maintenance?: number;
          description?: string;
          cost?: number;
          maintenance_date?: string;
          next_maintenance_mileage?: number;
          is_completed?: boolean;
          created_at?: string;
        };
      };
    };
  };
}
