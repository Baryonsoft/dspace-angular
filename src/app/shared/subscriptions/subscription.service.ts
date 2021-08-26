import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { createSelector, select, Store } from '@ngrx/store';
import { Observable, of as observableOf } from 'rxjs';
import { distinctUntilChanged, catchError, filter, map, mergeMap, startWith, switchMap, take, tap } from 'rxjs/operators';


import { NotificationsService } from '../../shared/notifications/notifications.service';
import { FollowLinkConfig } from '../../shared/utils/follow-link-config.model';
import { RemoteDataBuildService } from '../../core/cache/builders/remote-data-build.service';
import { RequestParam } from '../../core/cache/models/request-param.model';
import { ObjectCacheService } from '../../core/cache/object-cache.service';
import { DataService } from '../../core/data/data.service';
import { DSOChangeAnalyzer } from '../../core/data/dso-change-analyzer.service';
import { PaginatedList } from '../../core/data/paginated-list.model';
import { RemoteData } from '../../core/data/remote-data';
import { GetRequest, CreateRequest, PutRequest, DeleteRequest, FindListOptions, PostRequest, RestRequest } from '../../core/data/request.models';

import { RequestService } from '../../core/data/request.service';
import { HttpOptions } from '../../core/dspace-rest/dspace-rest.service';
import { HALEndpointService } from '../../core/shared/hal-endpoint.service';
import { Subscription } from './models/subscription.model';
import { dataService } from '../../core/cache/builders/build-decorators';
import { SUBSCRIPTION } from './models/subscription.resource-type';
import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { Community } from '../../core/shared/community.model';
import { Collection } from '../../core/shared/collection.model';
import { NoContent } from '../../core/shared/NoContent.model';
import { hasValue, hasValueOperator, isNotEmpty, isNotEmptyOperator } from '../../shared/empty.util';
import { URLCombiner } from '../../core/url-combiner/url-combiner';

import {
  getAllSucceededRemoteData,
  getFirstCompletedRemoteData,
  getFirstSucceededRemoteData,
  getFirstSucceededRemoteDataPayload,
  getRemoteDataPayload,
  sendRequest
} from '../../core/shared/operators';

/**
 * Provides methods to retrieve eperson group resources from the REST API & Group related CRUD actions.
 */
@Injectable({
  providedIn: 'root'
})
@dataService(SUBSCRIPTION)
export class SubscriptionService extends DataService<Subscription> {
  protected linkPath = 'subscriptions';

  protected browseEndpoint = '';

  constructor(
    protected comparator: DSOChangeAnalyzer<Subscription>,
    protected http: HttpClient,
    protected notificationsService: NotificationsService,
    protected requestService: RequestService,
    protected rdbService: RemoteDataBuildService,
    protected store: Store<any>,
    protected objectCache: ObjectCacheService,
    protected halService: HALEndpointService,
    protected nameService: DSONameService,
  ) {
    super();
  }

  getSubscriptionByPersonDSO(eperson: string, uuid: string): Observable<PaginatedList<Subscription>> {

    const optionsWithObject = Object.assign(new FindListOptions(), {
      searchParams: [
        new RequestParam('dspace_object_id', uuid),
        new RequestParam('eperson_id', eperson)
      ]
    });

    return this.searchBy("findByEPersonAndDso", optionsWithObject, false, true).pipe(
      getFirstCompletedRemoteData(),
      getRemoteDataPayload(),
    );

  }

  /**
   * Create a subscription for a given item or community or collection.
   *
   * @param subscription The subscription to create
   */
  createSubscription(subscription,eperson: string, uuid: string): Observable<RemoteData<Subscription>> {


    return this.halService.getEndpoint(this.linkPath).pipe(
      isNotEmptyOperator(),
      take(1),
      map((endpointUrl: string) => `${endpointUrl}?dspace_object_id=${uuid}&eperson_id=${eperson}`),
      map((endpointURL: string) => new CreateRequest(this.requestService.generateRequestId(), endpointURL, JSON.stringify(subscription))),
      sendRequest(this.requestService),
      switchMap((restRequest: RestRequest) => this.rdbService.buildFromRequestUUID(restRequest.uuid)),
      getFirstCompletedRemoteData(),
    ) as Observable<RemoteData<Subscription>>;
  }

  /**
   * Update a subscription for a given item or community or collection.
   *
   * @param subscription The subscription to create
   */
  updateSubscription(subscription,eperson: string, uuid: string) {

    return this.halService.getEndpoint(this.linkPath).pipe(
      isNotEmptyOperator(),
      take(1),
      map((endpointUrl: string) => `${endpointUrl}/${subscription.id}?dspace_object_id=${uuid}&eperson_id=${eperson}`),
      map((endpointURL: string) => new PutRequest(this.requestService.generateRequestId(), endpointURL, JSON.stringify(subscription))),
      sendRequest(this.requestService),
      switchMap((restRequest: RestRequest) => this.rdbService.buildFromRequestUUID(restRequest.uuid)),
      getFirstCompletedRemoteData(),
    ) as Observable<RemoteData<Subscription>>;
  }


  /**
   * Retrieves the {@link Bitstream}s in a given bundle
   *
   * @param bundle                      the bundle to retrieve bitstreams from
   * @param options                     options for the find all request
   * @param useCachedVersionIfAvailable If this is true, the request will only be sent if there's
   *                                    no valid cached version. Defaults to true
   * @param reRequestOnStale            Whether or not the request should automatically be re-
   *                                    requested after the response becomes stale
   * @param linksToFollow               List of {@link FollowLinkConfig} that indicate which
   *                                    {@link HALLink}s should be automatically resolved
   */
  findAllByResourceType( resourceType: string, options?: FindListOptions, useCachedVersionIfAvailable = true, reRequestOnStale = true, ...linksToFollow: FollowLinkConfig<Subscription>[]): Observable<RemoteData<PaginatedList<Subscription>>> {
    return this.halService.getEndpoint(this.linkPath).pipe(
      filter((href: string) => isNotEmpty(href)),
      distinctUntilChanged(),
      switchMap((endpointUrl) => this.findAllByHref(endpointUrl+"?resourceType="+resourceType, options, useCachedVersionIfAvailable, reRequestOnStale, ...linksToFollow))
    );
  }



  /**
   * Retrieves the {@link Bitstream}s in a given bundle
   *
   * @param bundle                      the bundle to retrieve bitstreams from
   * @param options                     options for the find all request
   * @param useCachedVersionIfAvailable If this is true, the request will only be sent if there's
   *                                    no valid cached version. Defaults to true
   * @param reRequestOnStale            Whether or not the request should automatically be re-
   *                                    requested after the response becomes stale
   * @param linksToFollow               List of {@link FollowLinkConfig} that indicate which
   *                                    {@link HALLink}s should be automatically resolved
   */
  deleteSubscription( id: string ): Observable<RemoteData<NoContent>> {
    return this.halService.getEndpoint(this.linkPath).pipe(
      filter((href: string) => isNotEmpty(href)),
      distinctUntilChanged(),
      switchMap((endpointUrl) => this.delete(id))
    );
  }


}
