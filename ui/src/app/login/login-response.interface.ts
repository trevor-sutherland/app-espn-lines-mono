export interface LoginResponse {
  message: string;
  user: {
    jwtToken: string;
  };
}
