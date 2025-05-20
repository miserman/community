#' Adds credits to a website
#'
#' Adds a credits section, which is automatically filled with the libraries used.
#' These can be added to or edited.
#'
#' @param add A list of credits to add. Each credit should be a list with at least entries for \code{"name"}
#' and \code{"url"}, and optionally a \code{"version"} and/or \code{"description"}. These can be named,
#' which will overwrite other credits with the same name.
#' @param exclude Names of automatic credits to exclude. The automatic credits are \code{"bootstrap"},
#' \code{"leaflet"} (from \code{\link{output_map}}), \code{"plotly"} (from \code{\link{output_plot}}), and
#' \code{"datatables"} (from \code{\link{output_table}}).
#' @examples
#' \dontrun{
#' # adds an institution credit, and excludes the default colorbrewer credit
#' output_credits(
#'   list(name = "Institution", url = "https://example.com", description = "The institution."),
#'   "colorbrewer"
#' )
#' }
#' @return A character vector of the contents to be added.
#' @export

output_credits <- function(add = NULL, exclude = NULL) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  id <- paste0("credits", caller$uid)
  r <- paste0(
    '<div id="',
    id,
    '" class="auto-output credits" data-autoType="credits"></div>'
  )
  if (building) {
    caller$content <- c(caller$content, r)
    if (!is.null(add) || !is.null(exclude)) {
      if (!is.null(names(add)) && "name" %in% names(add)) add <- list(add)
      caller$credit_output[[id]] <- list(add = add, exclude = exclude)
    }
    caller$uid <- caller$uid + 1
  }
  r
}
