import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login').then(m => m.Login),
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./signup/signup').then(m => m.Signup),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./reset-password/reset-password').then(m => m.ResetPasswordComponent),
  },
  {
    path: 'confirm-email-change',
    loadComponent: () =>
      import('./confirm-email-change/confirm-email-change').then(
        (m) => m.ConfirmEmailChangeComponent,
      ),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./scoreboard/scoreboard').then((m) => m.ScoreboardComponent),
  },
  {
    path: 'players/:userId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./player/player').then((m) => m.PlayerComponent),
  },
  {
    path: 'pick',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pick/pick').then(m => m.Pick),
  },
  {
    path: 'picks-summary',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./picks-summary/picks-summary').then(m => m.PicksSummary),
  },
  {
    path: 'results',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./results/results').then(m => m.ResultsComponent),
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./account/account').then(m => m.AccountComponent),
  },
  {
    path: 'admin/users',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin-users/admin-users').then(m => m.AdminUsersComponent),
  },
  {
    path: 'admin/pot',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin-pot/admin-pot').then(m => m.AdminPotComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
