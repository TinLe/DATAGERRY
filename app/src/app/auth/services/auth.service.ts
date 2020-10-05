/*
* DATAGERRY - OpenSource Enterprise CMDB
* Copyright (C) 2019 NETHINKS GmbH
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.

* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { ConnectionService } from '../../connect/connection.service';
import { User } from '../../management/models/user';
import { PermissionService } from './permission.service';
import { ApiCallService, ApiService } from '../../services/api-call.service';
import { IntroComponent } from '../../layout/intro/intro.component';
import { StepByStepIntroComponent } from '../../layout/intro/step-by-step-intro/step-by-step-intro.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SpecialService } from '../../framework/services/special.service';
import { Router } from '@angular/router';
import { LoginResponse } from '../models/responses';
import { Token } from '../models/token';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json'
  })
};


@Injectable({
  providedIn: 'root'
})
export class AuthService<T = any> implements ApiService {

  // Rest backend
  private restPrefix: string = 'rest';
  public readonly servicePrefix: string = 'auth';
  private http: HttpClient;

  // User storage
  private currentUserSubject: BehaviorSubject<User>;
  public currentUser: Observable<User>;
  private currentUserTokenSubject: BehaviorSubject<Token>;
  public currentUserToken: Observable<Token>;

  // First Step Intro
  private startIntroModal: any = undefined;
  private stepByStepModal: any = undefined;

  constructor(private backend: HttpBackend, private connectionService: ConnectionService, private api: ApiCallService,
              private permissionService: PermissionService, private router: Router, private introService: NgbModal,
              private specialService: SpecialService) {
    this.http = new HttpClient(backend);
    this.currentUserSubject = new BehaviorSubject<User>(
      JSON.parse(localStorage.getItem('current-user')));
    this.currentUser = this.currentUserSubject.asObservable();

    this.currentUserTokenSubject = new BehaviorSubject<Token>(
      JSON.parse(localStorage.getItem('access-token')));
    this.currentUserToken = this.currentUserTokenSubject.asObservable();
  }

  public get currentUserValue(): User {
    return this.currentUserSubject.value;
  }

  public get currentUserTokenValue(): Token {
    return this.currentUserTokenSubject.value;
  }


  public getAuthProviders(): Observable<T> {
    return this.api.callGet<T>(`${ this.servicePrefix }/providers`).pipe(
      map((apiResponse) => {
        return apiResponse.body;
      })
    );
  }

  public login(username: string, password: string) {
    const data = {
      user_name: username,
      password
    };
    return this.http.post<LoginResponse>(
      `${ this.connectionService.currentConnection }/${ this.restPrefix }/${ this.servicePrefix }/login`, data, httpOptions)
      .pipe(map((response: LoginResponse) => {
        const token: Token = {
          token: response.token,
          issued: response.token_issued_at,
          expire: response.token_expire
        };
        localStorage.setItem('current-user', JSON.stringify(response.user));
        localStorage.setItem('access-token', JSON.stringify(token));
        this.currentUserSubject.next(response.user);
        this.currentUserTokenSubject.next(token);
        this.showIntro();
        return response;
      }));
  }

  public logout() {
    localStorage.removeItem('current-user');
    localStorage.removeItem('access-token');
    this.currentUserSubject.next(null);
    this.currentUserTokenSubject.next(null);
    this.permissionService.clearUserRightStorage();

    // Close Intro-Modal if open
    if (this.startIntroModal !== undefined) {
      this.startIntroModal.close();
    }
    if (this.stepByStepModal !== undefined) {
      this.stepByStepModal.close();
    }
  }


  private showIntro() {
    this.specialService.getIntroStarter().subscribe(value => {
      const RUN = 'execute';
      if (!value[RUN]) {
        const options = { centered: true, backdrop: 'static', keyboard: true, windowClass: 'intro-tour', size: 'lg' };
        // @ts-ignore
        this.startIntroModal = this.introService.open(IntroComponent, options);
        this.startIntroModal.result.then((result) => {
          if (result) {
            this.router.navigate(['/framework/category/add']);
            this.showSteps();
          }
        }, (reason) => {
          console.log(reason);
        });
      }
    });
  }

  private showSteps() {
    const options = { backdrop: false, keyboard: true, windowClass: 'step-by-step' };
    this.stepByStepModal = this.introService.open(StepByStepIntroComponent, options);
    this.stepByStepModal.result.then((resp) => {
      if (resp) {
        this.router.navigate(['/']);
      }
    }, (reason) => {
      console.log(reason);
    });
  }
}
