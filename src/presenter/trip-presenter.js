import { render, RenderPosition, remove } from '../framework/render.js';
import NewSortingView from '../view/sorting-view.js';
import TripEventsView from '../view/events-view.js';
import ZeroEventsView from '../view/zero-events-view.js';
import LoadingView from '../view/loading-view.js';
import PointPresenter from './point-presenter.js';
import NewPointPresenter from './new-point-presenter.js';
import { sortPointByDay, sortPointByPrice, sortPointByTime } from '../utils/task.js';
import { SortType, UserAction, UpdateType, FilterType } from '../const.js';
import { filter as filterPoints } from '../utils/filter.js';

export default class TripEventsPresenter {
  #eventsList = null;
  #tripContainer = null;
  #pointPresenter = new Map();
  #pointNewPresenter = null;
  #currentSortType = SortType.DAY;
  #currentFilterType = FilterType.EVERYTHING;

  #pointsModel = null;
  #filterModel = null;

  #destinationsModel = null;
  #offersModel = null;

  #noEventsComponent = null;
  #sortingComponent = null;
  #loadingComponent = new LoadingView();

  #isLoading = true;

  constructor(tripContainer, pointsModel, offersModel, destinationsModel, filterModel) {
    this.#eventsList = new TripEventsView();
    this.#tripContainer = tripContainer;
    this.#pointsModel = pointsModel;
    this.#filterModel = filterModel;
    this.#destinationsModel = destinationsModel;
    this.#offersModel = offersModel;

    this.#pointNewPresenter = new NewPointPresenter(this.#eventsList.element, this.#handleViewAction,
      this.#destinationsModel.destinations, this.#offersModel.offers);

    this.#pointsModel.addObserver(this.#handleModelEvent);
    this.#filterModel.addObserver(this.#handleModelEvent);
    this.#destinationsModel.addObserver(this.#handleModelEvent);
    this.#offersModel.addObserver(this.#handleModelEvent);
  }

  init () {
    this.#renderTripEvents();
  }

  get points() {
    const points = this.#pointsModel.points;
    this.#currentFilterType = this.#filterModel.filter;
    const filteredPoints = filterPoints[this.#currentFilterType](points);

    switch (this.#currentSortType) {
      case SortType.PRICE:
        return filteredPoints.sort(sortPointByPrice);
      case SortType.TIME:
        return filteredPoints.sort(sortPointByTime);
      default:
        return filteredPoints.sort(sortPointByDay);
    }
  }

  get destinations() {
    return this.#destinationsModel.destinations;
  }

  get offers () {
    return this.#offersModel.offers;
  }

  #deleteNoEventsComponent = () => {
    if(this.#noEventsComponent){
      remove(this.#noEventsComponent);
    }
  };

  #renderPoint (point) {
    const pointPresenter = new PointPresenter(this.#eventsList.element, this.#handleViewAction, this.#handleModeChange);
    pointPresenter.init(point, this.destinations, this.offers);
    this.#pointPresenter.set(point.id, pointPresenter);
  }

  #renderNoEvents = () => {
    this.#noEventsComponent = new ZeroEventsView(this.#currentFilterType);
    render(this.#noEventsComponent, this.#tripContainer, RenderPosition.AFTERBEGIN);

    remove(this.#loadingComponent);
    remove(this.#sortingComponent);
  };

  #handleSortTypeChange = (sortType) => {
    if (this.#currentSortType === sortType) {
      return;
    }

    this.#sortPoints(sortType);
    this.#clearPoints();
    this.#renderTripEvents();
  };

  #sortPoints = (sortType) => {
    switch (sortType){
      case SortType.PRICE:
        this.#pointsModel.points.sort(sortPointByPrice);
        break;
      case SortType.TIME:
        this.#pointsModel.points.sort(sortPointByTime);
        break;
      default:
        this.#pointsModel.points.sort(sortPointByDay);
    }

    this.#currentSortType = sortType;
  };

  createPoint = (callback) => {
    this.#currentSortType = SortType.DAY;
    this.#filterModel.setFilter(UpdateType.MAJOR, FilterType.EVERYTHING);
    this.#pointNewPresenter.init(callback);
  };

  #renderSort = () => {
    this.#sortingComponent = new NewSortingView(this.#currentSortType);
    this.#sortingComponent.setSortTypeChangeHandler(this.#handleSortTypeChange);

    render(this.#sortingComponent, this.#tripContainer, RenderPosition.AFTERBEGIN);
  };

  #renderLoading() {
    render(this.#loadingComponent, this.#tripContainer, RenderPosition.AFTERBEGIN);
  }

  #renderTripEvents = () => {
    render(this.#eventsList, this.#tripContainer);

    if (this.#isLoading) {
      this.#renderLoading();
      return;
    }

    const points = this.points;

    for (let i = 0; i < this.points.length; i++){
      this.#renderPoint(this.points[i]);
    }

    if(points.length === 0){
      this.#renderNoEvents();
      return;
    }

    this.#renderSort();
  };

  #clearPoints = ({resetSortType = false} = {}) => {
    // this.#newFormPresenter.destroy();
    this.#pointPresenter.forEach((presenter) => presenter.destroy());
    this.#pointPresenter.clear();
    this.#pointNewPresenter.destroy();

    remove(this.#sortingComponent);
    remove(this.#loadingComponent);

    if(this.#noEventsComponent){
      remove(this.#noEventsComponent);
    }

    if (resetSortType) {
      this.#currentSortType = SortType.DAY;
    }

    if (this.#noEventsComponent) {
      remove(this.#noEventsComponent);
    }
  };

  #handleViewAction = (actionType, updateType, update) => {
    switch (actionType) {
      case UserAction.UPDATE_POINT:
        this.#pointsModel.updatePoint(updateType, update);
        break;
      case UserAction.ADD_POINT:
        this.#pointsModel.addPoint(updateType, update);
        break;
      case UserAction.DELETE_POINT:
        this.#pointsModel.deletePoint(updateType, update);
        break;
    }
  };

  #handleModelEvent = (updateType, data) => {
    switch (updateType) {
      case UpdateType.PATCH:
        this.#pointPresenter.get(data.id).init(data, this.destinations, this.offers);
        break;
      case UpdateType.MINOR:
        this.#clearPoints();
        this.#renderTripEvents();
        break;
      case UpdateType.MAJOR:
        this.#clearPoints({resetSortType: true});
        this.#renderTripEvents();
        break;
      case UpdateType.INIT:
        this.#isLoading = false;
        remove(this.#loadingComponent);
        this.#deleteNoEventsComponent();
        this.#renderTripEvents();
        break;
    }
  };

  #handleModeChange = () => {
    this.#pointNewPresenter.destroy();
    this.#pointPresenter.forEach((presenter) => presenter.resetView());
  };
}
